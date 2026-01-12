// ==========================================
// Parse Cloud Code - Main Application with Profit Control
// ==========================================

const OneSignal = require('@onesignal/node-onesignal');

// OneSignal config
const app_id = "7dec5bab-5550-4977-af9d-563e58d64721";
const user_key_token = "os_v2_app_pxwfxk2vkbexpl45ky7frvsheggbgluub3ieoi4f6ucaegwq5cqtr7lclpqnl6u72m67j3qe4vycrflddjervdoe5iyqpbd2njshwia";
const rest_api_key = "gbgluub3ieoi4f6ucaegwq5cq";

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;

const configuration = OneSignal.createConfiguration({
  userAuthKey: user_key_token,
  restApiKey: rest_api_key,
});
const client = new OneSignal.DefaultApi(configuration);

//////////////////////////////////////////////////////////
// =================== نظام الربحية ===================
//////////////////////////////////////////////////////////

// ==========================================================================
// 1. تعريف الجداول (Classes) - أضف هذا في بداية ملف main.js
// ==========================================================================
const FruitJackpotResults = Parse.Object.extend("FruitJackpotResults");
const FruitJackpotBets = Parse.Object.extend("FruitJackpotBets");

// ==========================================================================
// 2. إعدادات اللعبة - أضف هذا تحت التعريفات
// ==========================================================================
const FJ_ROUND_DURATION = 30; // مدة الجولة بالثواني
const FJ_MULTIPLIERS = {
    'strawberry': 3,
    'banana': 3,
    'grape': 5,
    'watermelon': 45,
    'star': 25,
    'apple': 5,
    'peach': 25,
    'lemon': 15,
    'orange': 10
};
const FJ_FRUITS = Object.keys(FJ_MULTIPLIERS);

// ==========================================================================
// 3. الدوال السحابية (Cloud Functions) - أضفها في نهاية ملف main.js
// ==========================================================================

/**
 * جلب معلومات اللعبة الحالية للمستخدم
 */
Parse.Cloud.define("fruit_jackpot_info", async (request) => {
    const user = request.user;
    if (!user) return { code: 700, message: "User not authenticated" };

    await user.fetch({ useMasterKey: true });
    const currentTime = Math.floor(Date.now() / 1000);
    const currentRound = Math.floor(currentTime / FJ_ROUND_DURATION);
    const countdown = FJ_ROUND_DURATION - (currentTime % FJ_ROUND_DURATION);

    // جلب آخر 20 نتيجة من جدول النتائج
    const resultsQuery = new Parse.Query(FruitJackpotResults);
    resultsQuery.descending("round");
    resultsQuery.limit(20);
    const recentResults = await resultsQuery.find({ useMasterKey: true });

    // جلب رهانات المستخدم في الجولة الحالية
    const userBetsQuery = new Parse.Query(FruitJackpotBets);
    userBetsQuery.equalTo("user", user);
    userBetsQuery.equalTo("round", currentRound);
    const userBets = await userBetsQuery.find({ useMasterKey: true });
    
    const betsMap = {};
    userBets.forEach(b => { 
        betsMap[b.get("choice")] = (betsMap[b.get("choice")] || 0) + b.get("amount"); 
    });

    return {
        code: 200,
        data: {
            credits: user.get("credit") || 0, // الرصيد من حقل credit
            round: currentRound,
            countdown: countdown,
            history: recentResults.map(r => ({
                fruit: r.get("winningFruit"),
                multiplier: r.get("multiplier")
            })),
            myBets: betsMap,
            nickname: user.get('first_name') || user.get('username'),
            avatar: user.get('avatar') ? (user.get('avatar').url ? user.get('avatar').url : user.get('avatar')) : ''
        }
    };
});

/**
 * وضع رهان جديد
 */
Parse.Cloud.define("fruit_jackpot_bet", async (request) => {
    const user = request.user;
    if (!user) return { code: 700, message: "User not authenticated" };

    const { choice, gold } = request.params;
    if (!FJ_MULTIPLIERS[choice] || gold <= 0) return { code: 400, message: "Invalid bet" };

    const currentTime = Math.floor(Date.now() / 1000);
    const currentRound = Math.floor(currentTime / FJ_ROUND_DURATION);
    const timeInRound = currentTime % FJ_ROUND_DURATION;

    // إغلاق الرهان في آخر 5 ثوانٍ
    if (timeInRound > FJ_ROUND_DURATION - 5) {
        return { code: 403, message: "Betting closed for this round" };
    }

    await user.fetch({ useMasterKey: true });
    const currentBalance = user.get("credit") || 0;

    if (currentBalance < gold) {
        return { code: 10062, message: "Insufficient balance" };
    }

    // خصم الرصيد فوراً
    user.increment("credit", -gold);
    await user.save(null, { useMasterKey: true });

    // تسجيل الرهان في الجدول
    const bet = new FruitJackpotBets();
    bet.set("user", user);
    bet.set("round", currentRound);
    bet.set("choice", choice);
    bet.set("amount", gold);
    bet.set("isWinner", false);
    await bet.save(null, { useMasterKey: true });

    return { code: 200, newBalance: user.get("credit") };
});

/**
 * دالة إنهاء الجولة وتوزيع الأرباح
 * ملاحظة: يجب استدعاء هذه الدالة كل 30 ثانية عبر Cron Job
 */
Parse.Cloud.define("fruit_jackpot_process_round", async (request) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const currentRound = Math.floor(currentTime / FJ_ROUND_DURATION);
    const roundToProcess = currentRound - 1;

    // التأكد من عدم معالجة الجولة مرتين
    const checkQuery = new Parse.Query(FruitJackpotResults);
    checkQuery.equalTo("round", roundToProcess);
    if (await checkQuery.first({ useMasterKey: true })) return "Already processed";

    // 1. اختيار الفاكهة الفائزة (عشوائي)
    const winningFruit = FJ_FRUITS[Math.floor(Math.random() * FJ_FRUITS.length)];
    const multiplier = FJ_MULTIPLIERS[winningFruit];

    // 2. حفظ النتيجة في الجدول
    const resultRecord = new FruitJackpotResults();
    resultRecord.set("round", roundToProcess);
    resultRecord.set("winningFruit", winningFruit);
    resultRecord.set("multiplier", multiplier);
    await resultRecord.save(null, { useMasterKey: true });

    // 3. البحث عن الرهانات الفائزة وتوزيع الأرباح
    const betsQuery = new Parse.Query(FruitJackpotBets);
    betsQuery.equalTo("round", roundToProcess);
    betsQuery.equalTo("choice", winningFruit);
    betsQuery.include("user");
    const winningBets = await betsQuery.find({ useMasterKey: true });

    for (const bet of winningBets) {
        const winner = bet.get("user");
        const winAmount = Math.floor(bet.get("amount") * multiplier);
        
        winner.increment("credit", winAmount);
        await winner.save(null, { useMasterKey: true });
        
        bet.set("winAmount", winAmount);
        bet.set("isWinner", true);
        await bet.save(null, { useMasterKey: true });
    }

    return { status: "Success", winningFruit, winners: winningBets.length };
});

// إعدادات النظام الاقتصادية
const PROFIT_SYSTEM = {
    SYSTEM_PROFIT_TARGET: 0.70,    // 70% ربح للنظام
    USER_PROFIT_TARGET: 0.40,      // 40% أرباح للمستخدمين
    MIN_PROFIT_MARGIN: 0.65,       // الحد الأدنى لربحية النظام 65%
    MAX_PROFIT_MARGIN: 0.75        // الحد الأقصى لربحية النظام 75%
};

// مضاعفات الفواكه الأساسية للنظام القديم
const FRUIT_MULTIPLIERS = {
    'g': 45,  // x45 - نادر جداً
    'h': 5,   // x5
    'a': 5,   // x5
    'b': 5,   // x5
    'c': 5,   // x5
    'd': 10,  // x10
    'e': 15,  // x15
    'f': 25   // x25
};

// خريطة الفواكه للنظام القديم
const FRUIT_MAP = {
    6: 'g',
    7: 'h',
    8: 'a',
    1: 'b',
    2: 'c',
    3: 'd',
    4: 'e',
    5: 'f',
};

// عكس الخريطة
const REVERSE_FRUIT_MAP = {
    'g': 0, 'h': 1, 'a': 2, 'b': 3,
    'c': 4, 'd': 5, 'e': 6, 'f': 7
};

//////////////////////////////////////////////////////////
// =================== نظام إحصائيات الربح ===================
//////////////////////////////////////////////////////////

class ProfitStatisticsSystem {
    constructor() {
        this.dailyStats = {};
        this.roundStats = [];
        this.userProfitStats = {};
        this.systemProfit = 0;
        this.totalBets = 0;
        this.totalPayout = 0;
    }
    
    /**
     * تسجيل نتائج الجولة
     */
    recordRoundResult(round, totalBetsAmount, totalPayout, resultFruit) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // تهيئة إحصائيات اليوم
        if (!this.dailyStats[today]) {
            this.dailyStats[today] = {
                date: today,
                totalRounds: 0,
                totalBets: 0,
                totalPayout: 0,
                systemProfit: 0,
                profitMargin: 0
            };
        }
        
        // حساب ربح النظام
        const systemProfit = totalBetsAmount - totalPayout;
        const profitMargin = totalBetsAmount > 0 ? (systemProfit / totalBetsAmount) : 0;
        
        // تحديث الإحصائيات
        this.systemProfit += systemProfit;
        this.totalBets += totalBetsAmount;
        this.totalPayout += totalPayout;
        
        // تحديث إحصائيات اليوم
        const dayStat = this.dailyStats[today];
        dayStat.totalRounds++;
        dayStat.totalBets += totalBetsAmount;
        dayStat.totalPayout += totalPayout;
        dayStat.systemProfit += systemProfit;
        dayStat.profitMargin = dayStat.totalBets > 0 ? 
            (dayStat.systemProfit / dayStat.totalBets) : 0;
        
        // حفظ إحصائيات الجولة
        const roundStat = {
            round: round,
            timestamp: now,
            totalBets: totalBetsAmount,
            totalPayout: totalPayout,
            systemProfit: systemProfit,
            profitMargin: profitMargin,
            resultFruit: resultFruit
        };
        
        this.roundStats.push(roundStat);
        
        // الحفاظ على آخر 5000 جولة فقط
        if (this.roundStats.length > 5000) {
            this.roundStats.shift();
        }
        
        return roundStat;
    }
    
    /**
     * الحصول على تقرير الربحية
     */
    getProfitReport(days = 7) {
        const today = new Date();
        const reports = [];
        
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            if (this.dailyStats[dateStr]) {
                reports.push(this.dailyStats[dateStr]);
            }
        }
        
        const totalReport = {
            days: days,
            totalRounds: reports.reduce((sum, r) => sum + r.totalRounds, 0),
            totalBets: reports.reduce((sum, r) => sum + r.totalBets, 0),
            totalPayout: reports.reduce((sum, r) => sum + r.totalPayout, 0),
            systemProfit: reports.reduce((sum, r) => sum + r.systemProfit, 0),
            averageProfitMargin: 0,
            reports: reports
        };
        
        if (totalReport.totalBets > 0) {
            totalReport.averageProfitMargin = totalReport.systemProfit / totalReport.totalBets;
        }
        
        return totalReport;
    }
    
    /**
     * الحصول على ربحية النظام الحالية
     */
    getCurrentProfitMargin() {
        if (this.totalBets === 0) return 0;
        return this.systemProfit / this.totalBets;
    }
}

// تهيئة نظام الإحصائيات
const profitSystem = new ProfitStatisticsSystem();

//////////////////////////////////////////////////////////
// =================== نظام التحكم الذكي ===================
//////////////////////////////////////////////////////////

class SmartProfitController {
    constructor() {
        this.fruitStats = {};
        this.initializeFruitStats();
    }
    
    initializeFruitStats() {
        // تهيئة إحصائيات لكل فاكهة
        const fruits = ['g', 'h', 'a', 'b', 'c', 'd', 'e', 'f'];
        fruits.forEach(fruit => {
            this.fruitStats[fruit] = {
                occurrences: 0,
                totalPayout: 0,
                totalBets: 0,
                lastOccurrence: null
            };
        });
    }
    
    /**
     * حساب أفضل فاكهة لتحقيق ربحية 70%
     */
    calculateOptimalFruit(totalBetsByFruit, currentRound) {
        console.log("🧮 حساب الفاكهة المثلى لتحقيق 70% ربحية...");
        
        // حساب إجمالي الرهانات
        let totalBetAmount = 0;
        const betAmounts = {};
        
        // تحويل الرهانات إلى مبالغ
        Object.entries(totalBetsByFruit).forEach(([fruit, amount]) => {
            betAmounts[fruit] = amount;
            totalBetAmount += amount;
        });
        
        if (totalBetAmount === 0) {
            // لا توجد رهانات، إرجاع فاكهة عشوائية
            const fruits = ['g', 'h', 'a', 'b', 'c', 'd', 'e', 'f'];
            return fruits[Math.floor(Math.random() * fruits.length)];
        }
        
        let optimalFruit = 'g';
        let bestProfitMargin = -Infinity;
        
        // حساب ربحية كل فاكهة
        Object.entries(FRUIT_MULTIPLIERS).forEach(([fruit, multiplier]) => {
            const betAmount = betAmounts[fruit] || 0;
            const potentialPayout = betAmount * multiplier;
            const systemProfit = totalBetAmount - potentialPayout;
            const profitMargin = totalBetAmount > 0 ? systemProfit / totalBetAmount : 0;
            
            // تطبيق عوامل الترجيح
            let weightedProfit = this.applyWeightingFactors(
                profitMargin, 
                fruit, 
                betAmount,
                totalBetAmount,
                currentRound
            );
            
            console.log(`🍎 فاكهة ${fruit} (x${multiplier}): 
                الرهان=${betAmount}, 
                الربح=${systemProfit}, 
                النسبة=${(profitMargin * 100).toFixed(2)}%,
                الموزون=${(weightedProfit * 100).toFixed(2)}%`);
            
            // البحث عن أفضل ربحية (هدفنا 70%)
            const targetProfit = 0.70;
            const profitDeviation = Math.abs(weightedProfit - targetProfit);
            
            if (profitDeviation < Math.abs(bestProfitMargin - targetProfit) || 
                (profitDeviation === Math.abs(bestProfitMargin - targetProfit) && systemProfit > 0)) {
                bestProfitMargin = weightedProfit;
                optimalFruit = fruit;
            }
        });
        
        console.log(`🎯 الفاكهة المثلى: ${optimalFruit} 
            (نسبة الربح المتوقعة: ${(bestProfitMargin * 100).toFixed(2)}%)`);
        
        return optimalFruit;
    }
    
    /**
     * تطبيق عوامل الترجيح
     */
    applyWeightingFactors(baseProfit, fruit, betAmount, totalBets, currentRound) {
        let weightedProfit = baseProfit;
        
        // 1. عامل الفاكهة عالية المضاعف (x45)
        if (fruit === 'g') {
            // تقليل فرصة ظهور x45 إلا في حالات معينة
            const hoursSinceLastX45 = this.getHoursSinceLastOccurrence('g');
            if (hoursSinceLastX45 < 2) {
                weightedProfit *= 0.7; // تقليل الربحية إذا ظهرت مؤخراً
            }
            
            // إذا كان الرهان على x45 كبير جداً، نفضل عدم اختيارها
            const x45Percentage = totalBets > 0 ? (betAmount / totalBets) * 100 : 0;
            if (x45Percentage > 30) {
                weightedProfit *= 0.8;
            }
        }
        
        // 2. عامل التكرار التاريخي
        const fruitStats = this.fruitStats[fruit];
        if (fruitStats.occurrences > 0) {
            const expectedOccurrences = currentRound / 8; // متوسط متوقع
            const actualOccurrences = fruitStats.occurrences;
            
            if (actualOccurrences > expectedOccurrences * 1.5) {
                // ظهرت كثيراً، نقلل فرصتها
                weightedProfit *= 0.9;
            } else if (actualOccurrences < expectedOccurrences * 0.5) {
                // ظهرت قليلاً، نزيد فرصتها
                weightedProfit *= 1.1;
            }
        }
        
        // 3. عامل حجم الرهان
        const betPercentage = totalBets > 0 ? (betAmount / totalBets) : 0;
        if (betPercentage > 0.4) {
            // إذا تجاوزت رهانات الفاكهة 40% من إجمالي الرهانات
            weightedProfit *= 1.15; // زيادة الربحية لتجنب الدفع الكبير
        }
        
        return Math.max(0.1, Math.min(0.9, weightedProfit));
    }
    
    getHoursSinceLastOccurrence(fruit) {
        const stats = this.fruitStats[fruit];
        if (!stats.lastOccurrence) return 999; // لم تظهر من قبل
        
        const now = new Date();
        const diffMs = now - stats.lastOccurrence;
        return diffMs / (1000 * 60 * 60);
    }
    
    /**
     * تحديث إحصائيات الفاكهة
     */
    updateFruitStats(fruit, payout, totalBets) {
        const stats = this.fruitStats[fruit];
        stats.occurrences++;
        stats.totalPayout += payout;
        stats.totalBets += totalBets;
        stats.lastOccurrence = new Date();
    }
    
    /**
     * الحصول على رقم الفاكهة من الحرف
     */
    getFruitNumber(fruitChar) {
        const fruitMap = {
            'g': 6, 'h': 7, 'a': 8,
            'b': 1, 'c': 2, 'd': 3,
            'e': 4, 'f': 5
        };
        return fruitMap[fruitChar] || 6;
    }
    
    /**
     * الحصول على حرف الفاكهة من الرقم
     */
    getFruitChar(fruitNumber) {
        const reverseMap = {
            6: 'g', 7: 'h', 8: 'a',
            1: 'b', 2: 'c', 3: 'd',
            4: 'e', 5: 'f'
        };
        return reverseMap[fruitNumber] || 'g';
    }
}

// تهيئة المتحكم
const profitController = new SmartProfitController();

//////////////////////////////////////////////////////////
// =================== دوال المساعدة ===================
//////////////////////////////////////////////////////////

/**
 * استخراج رابط الصورة من بيانات Parse File
 */
function getImageUrl(avatarData) {
    if (!avatarData) return '/images/default-avatar.png'; // صورة افتراضية

    // إذا كان Parse.File
    if (avatarData instanceof Parse.File) {
        return avatarData.url(); // الرابط الصحيح من Parse
    }

    // إذا كان كائن يحتوي على url
    if (typeof avatarData === 'object' && avatarData !== null) {
        if (avatarData.url) return avatarData.url;
        if (avatarData._url) return avatarData._url;
    }

    // إذا كان string
    if (typeof avatarData === 'string') {
        if (avatarData.startsWith('http://') || avatarData.startsWith('https://')) {
            return avatarData;
        }
    }

    // fallback
    return 'https://flamingoappparse.s3.ap-southeast-1.amazonaws.com/ic_launcher-playstore.png';
}


/**
 * استخراج اسم المستخدم
 */
function getNickname(user) {
    if (!user) return 'Unknown User';
    
    const firstName = user.get('first_name');
    if (firstName && firstName !== user.id && firstName !== user.get('username')) {
        const lastName = user.get('last_name') || '';
        return firstName + (lastName ? ' ' + lastName : '');
    }
    
    const username = user.get('username');
    if (username) return username;
    
    const name = user.get('name');
    if (name) return name;
    
    return `User_${user.id.substring(0, 6)}`;
}

//////////////////////////////////////////////////////////
// =================== دوال التطبيق الرئيسية ===================
//////////////////////////////////////////////////////////

// 1. إرسال إشعار Push
Parse.Cloud.define('sendPush', async (request) => {
    const { type, receiverId, followers, title, alert, avatar, big_picture, view, senderId, senderName, chat, objectId } = request.params;
    
    let userQuery = new Parse.Query(Parse.User);
    
    if (type == "live") {
        userQuery.containedIn("objectId", followers);
    } else {
        userQuery.equalTo("objectId", receiverId);
    }

    const notification = new OneSignal.Notification();
    notification.app_id = app_id;
    notification.headings = { en: title };  
    notification.contents = { en: alert };
    notification.large_icon = avatar;
    notification.big_picture = big_picture;
    notification.target_channel = "Push";
    notification.include_aliases = {
        external_id: [receiverId]
    };  
    notification.data = {
        view: view,
        alert: alert,
        senderId: senderId,
        senderName: senderName,
        type: type,
        chat: chat,
        avatar: avatar,
        objectId: objectId,
    };

    try {
        const response = await client.createNotification(notification);
        console.log("✅ Push notification sent successfully");
        return "sent";
    } catch (error) {
        console.error("❌ Push notification error:", error);
        throw new Parse.Error(Parse.Error.SCRIPT_FAILED, `Push failed: ${error.message}`);
    }
});

// 2. تحديث كلمة المرور
Parse.Cloud.define("updatePassword", async (request) => {
    const { username, password } = request.params;

    if (!username || !password) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Username and password are required");
    }

    const userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo("username", username);

    const user = await userQuery.first({ useMasterKey: true });
    if (!user) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "User not found");

    user.set("password", password);
    user.set("secondary_password", password);
    await user.save(null, { useMasterKey: true });

    return "Password updated successfully";
});

// 3. إرسال هدية
Parse.Cloud.define("send_gift", async (request) => {
    const { objectId, credits } = request.params;

    if (!objectId || !credits) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "User ID and credits are required");
    }

    const user = await new Parse.Query(Parse.User).get(objectId, { useMasterKey: true });
    if (!user) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "User not found");

    user.increment("diamonds", parseInt(credits));
    user.increment("diamondsTotal", parseInt(credits));

    await user.save(null, { useMasterKey: true });
    return "Gift sent successfully";
});

// 4. إرسال هدية الوكالة
Parse.Cloud.define("send_agency", async (request) => {
    const { objectId, credits } = request.params;

    if (!objectId || !credits) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "User ID and credits are required");
    }

    const user = await new Parse.Query(Parse.User).get(objectId, { useMasterKey: true });
    if (!user) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "User not found");

    user.increment("diamondsAgency", parseInt(credits));
    user.increment("diamondsAgencyTotal", parseInt(credits));

    await user.save(null, { useMasterKey: true });
    return "Agency gift sent successfully";
});

// 5. التحقق من رقم الهاتف
Parse.Cloud.define("check_phone_number", async (request) => {
    const phone = request.params.phone_number;

    if (!phone) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Phone number is required");
    }

    const user = await new Parse.Query(Parse.User)
        .equalTo("phone_number_full", phone)
        .first({ useMasterKey: true });

    if (user) {
        throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, "Phone number already exists");
    }
    
    return "Phone number is available";
});

// 6. إعادة تشغيل معركة PK
Parse.Cloud.define("restartPkBattle", async (request) => {
    const { liveChannel, times } = request.params;

    const live = await new Parse.Query("Streaming")
        .equalTo("streaming_channel", liveChannel)
        .equalTo("streaming", true)
        .equalTo("battle_status", "battle_alive")
        .first();

    if (!live) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Streaming not found");

    live.set("his_points", 0);
    live.set("my_points", 0);
    live.set("repeat_battle_times", parseInt(times) || 0);

    await live.save();
    return "PK battle restarted";
});

// 7. حفظ نقاط المعركة
Parse.Cloud.define("save_hisBattle_points", async (request) => {
    const { points, liveChannel } = request.params;

    const live = await new Parse.Query("Streaming")
        .equalTo("streaming_channel", liveChannel)
        .equalTo("streaming", true)
        .equalTo("battle_status", "battle_alive")
        .first();

    if (!live) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Streaming not found");

    live.set("his_points", parseInt(points) || 0);
    await live.save();
    
    return "Battle points saved";
});

// 8. متابعة مستخدم
Parse.Cloud.define("follow_user", async (request) => {
    const { authorId, receiverId } = request.params;

    if (!authorId || !receiverId) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Both user IDs are required");
    }

    if (authorId === receiverId) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Cannot follow yourself");
    }

    const author = await new Parse.Query(Parse.User).get(authorId, { useMasterKey: true });
    const receiver = await new Parse.Query(Parse.User).get(receiverId, { useMasterKey: true });

    if (!author || !receiver) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "User not found");
    }

    author.addUnique("following", receiverId);
    receiver.addUnique("followers", authorId);

    await author.save(null, { useMasterKey: true });
    await receiver.save(null, { useMasterKey: true });

    return {
        success: true,
        message: "Followed successfully",
        authorId: authorId,
        receiverId: receiverId
    };
});

// 9. إلغاء متابعة مستخدم
Parse.Cloud.define("unfollow_user", async (request) => {
    const { authorId, receiverId } = request.params;

    if (!authorId || !receiverId) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Both user IDs are required");
    }

    const author = await new Parse.Query(Parse.User).get(authorId, { useMasterKey: true });
    const receiver = await new Parse.Query(Parse.User).get(receiverId, { useMasterKey: true });

    if (!author || !receiver) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "User not found");
    }

    author.remove("following", receiverId);
    receiver.remove("followers", authorId);

    await author.save(null, { useMasterKey: true });
    await receiver.save(null, { useMasterKey: true });

    return {
        success: true,
        message: "Unfollowed successfully",
        authorId: authorId,
        receiverId: receiverId
    };
});

// 10. التحقق من RevenueCat وإضافة العملات
Parse.Cloud.define("verifyAndAddCoins", async (request) => {
    const { userId, productId, transactionId, purchaseDate } = request.params;

    const user = request.user;
    if (!user || user.id !== userId) {
        throw new Parse.Error(209, "Unauthorized");
    }

    if (!REVENUECAT_API_KEY) {
        throw new Parse.Error(Parse.Error.SCRIPT_FAILED, "RevenueCat API key not configured");
    }

    const PaymentsModel = Parse.Object.extend("PaymentsModel");

    // التحقق من عدم تكرار المعاملة
    const exists = await new Parse.Query(PaymentsModel)
        .equalTo("transactionId", transactionId)
        .first({ useMasterKey: true });

    if (exists) throw new Parse.Error(141, "Duplicate transaction");

    // التحقق مع RevenueCat
    const url = `https://api.revenuecat.com/v1/subscribers/${userId}`;
    const res = await fetch(url, {
        headers: { 
            Authorization: `Bearer ${REVENUECAT_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        console.error("RevenueCat API error:", res.status, res.statusText);
        throw new Parse.Error(141, `RevenueCat error: ${res.status}`);
    }

    const data = await res.json();
    console.log("RevenueCat response:", JSON.stringify(data).substring(0, 500));

    const transactions = data.subscriber?.non_subscriptions?.[productId] || [];
    const verifiedTx = transactions.find(tx => tx.id === transactionId);

    if (!verifiedTx) {
        console.error("Transaction not found in RevenueCat:", transactionId);
        throw new Parse.Error(141, "Invalid transaction");
    }

    // استخراج عدد العملات من productId
    const match = productId.match(/flamingo\.(\d+)\.credits/);
    if (!match) throw new Parse.Error(141, "Invalid product format");

    const coins = parseInt(match[1], 10);
    if (isNaN(coins) || coins <= 0) {
        throw new Parse.Error(141, "Invalid coins amount");
    }

    // إضافة العملات للمستخدم
    const currentCredits = user.get("credit") || 0;
    user.set("credit", currentCredits + coins);
    await user.save(null, { useMasterKey: true });

    // تسجيل المعاملة
    const payment = new PaymentsModel();
    payment.set("author", user);
    payment.set("authorId", userId);
    payment.set("transactionId", transactionId);
    payment.set("productId", productId);
    payment.set("coins", coins);
    payment.set("purchaseDate", new Date(purchaseDate));
    payment.set("paymentType", "coins");
    payment.set("status", "completed");

    await payment.save(null, { useMasterKey: true });

    return { 
        success: true, 
        coinsAdded: coins, 
        userId,
        newBalance: user.get("credit")
    };
});

//////////////////////////////////////////////////////////
// =================== GAMES API ===================
//////////////////////////////////////////////////////////

// تعريف الفئات للنظام القديم
const FerrisWheelChoices = Parse.Object.extend("FerrisWheelChoices");
const FerrisWheelResults = Parse.Object.extend("FerrisWheelResults");

// إعدادات اللعبة
const ROUND_DURATION = 45; // مدة الجولة بالثواني

//////////////////////////////////////////////////////////
// جلب معلومات اللعبة والجولة الحالية - مع نظام الربحية
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_info", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    const userId = user.id;
    console.log(`🎮 Game info requested for user: ${userId}`);
    
    await user.fetch({ useMasterKey: true });
    
    // حساب الجولة الحالية
    const currentTime = Math.floor(Date.now() / 1000);
    const currentRound = Math.floor(currentTime / ROUND_DURATION);
    const roundStartTime = currentRound * ROUND_DURATION;
    const roundEndTime = roundStartTime + ROUND_DURATION;
    const countdown = Math.max(0, roundEndTime - currentTime);

    // جلب بيانات المستخدم
    const userCredits = user.get("credit") || 0;
    const userProfit = user.get("gameProfit") || 0;
    
    const userAvatar = getImageUrl(user.get("avatar"));
    const userNickname = getNickname(user);
    
    console.log(`👤 User data - Avatar: ${userAvatar ? 'Found' : 'Not found'}, Nickname: ${userNickname}`);

    // التحقق من نتيجة الجولة السابقة
    const lastResultQuery = new Parse.Query(FerrisWheelResults);
    lastResultQuery.equalTo("round", currentRound - 1);
    let lastResult = await lastResultQuery.first({ useMasterKey: true });

    let previousWinningFruit = null;
    let topList = [];
    let totalBetsAmount = 0;
    let totalPayoutAmount = 0;

    if (!lastResult && currentRound > 0) {
        // حساب الرهانات في الجولة السابقة
        const previousBetsQuery = new Parse.Query(FerrisWheelChoices);
        previousBetsQuery.equalTo("round", currentRound - 1);
        const previousBets = await previousBetsQuery.find({ useMasterKey: true });
        
        // حساب إجمالي الرهانات لكل فاكهة
        const betsByFruit = {};
        previousBets.forEach(bet => {
            const fruit = bet.get("choice");
            const amount = bet.get("gold") || 0;
            betsByFruit[fruit] = (betsByFruit[fruit] || 0) + amount;
            totalBetsAmount += amount;
        });
        
        // استخدام نظام التحكم الذكي لاختيار الفاكهة الرابحة
        previousWinningFruit = profitController.calculateOptimalFruit(betsByFruit, currentRound - 1);
        
        // تسجيل نتيجة الجولة السابقة
        const newResult = new FerrisWheelResults();
        newResult.set("round", currentRound - 1);
        newResult.set("result", previousWinningFruit);
        await newResult.save(null, { useMasterKey: true });

        // تحديث أرباح الفائزين
        const winningBetsQuery = new Parse.Query(FerrisWheelChoices);
        winningBetsQuery.equalTo("round", currentRound - 1);
        winningBetsQuery.equalTo("choice", previousWinningFruit);
        const winningBets = await winningBetsQuery.find({ useMasterKey: true });

        for (const bet of winningBets) {
            const betUserId = bet.get("userId");
            const betGold = bet.get("gold") || 0;
            const winAmount = Math.floor(betGold * FRUIT_MULTIPLIERS[previousWinningFruit]);
            totalPayoutAmount += winAmount;

            const betUser = await new Parse.Query(Parse.User).get(betUserId, { useMasterKey: true });
            if (betUser) {
                await betUser.fetch({ useMasterKey: true });
                betUser.increment("credit", winAmount);
                betUser.increment("gameProfit", winAmount);
                await betUser.save(null, { useMasterKey: true });

                // إضافة للقائمة العليا
                const betUserAvatar = getImageUrl(betUser.get("avatar"));
                const betUserNickname = getNickname(betUser);
                
                topList.push({
                    uid: betUserId,
                    avatar: betUserAvatar,
                    nick: betUserNickname,
                    total: winAmount,
                });
            }
        }
        
        // تسجيل إحصائيات الربحية
        profitSystem.recordRoundResult(
            currentRound - 1,
            totalBetsAmount,
            totalPayoutAmount,
            previousWinningFruit
        );
        
        // تحديث إحصائيات الفاكهة
        profitController.updateFruitStats(
            previousWinningFruit,
            totalPayoutAmount,
            totalBetsAmount
        );
        
        console.log(`💰 Round ${currentRound - 1}: 
            Total Bets: ${totalBetsAmount}, 
            Total Payout: ${totalPayoutAmount}, 
            System Profit: ${totalBetsAmount - totalPayoutAmount},
            Profit Margin: ${((totalBetsAmount - totalPayoutAmount) / totalBetsAmount * 100).toFixed(2)}%`);
    } else if (lastResult) {
        previousWinningFruit = lastResult.get("result");

        // جلب قائمة الفائزين
        const winningBetsQuery = new Parse.Query(FerrisWheelChoices);
        winningBetsQuery.equalTo("round", currentRound - 1);
        winningBetsQuery.equalTo("choice", previousWinningFruit);
        winningBetsQuery.limit(10);
        const winningBets = await winningBetsQuery.find({ useMasterKey: true });

        for (const bet of winningBets) {
            const betUserId = bet.get("userId");
            const betGold = bet.get("gold") || 0;
            const winAmount = Math.floor(betGold * FRUIT_MULTIPLIERS[previousWinningFruit]);

            const betUser = await new Parse.Query(Parse.User).get(betUserId, { useMasterKey: true });
            if (betUser) {
                await betUser.fetch({ useMasterKey: true });
                const betUserAvatar = getImageUrl(betUser.get("avatar"));
                const betUserNickname = getNickname(betUser);
                
                topList.push({
                    uid: betUserId,
                    avatar: betUserAvatar,
                    nick: betUserNickname,
                    total: winAmount,
                });
            }
        }
    }

    // جلب آخر 10 نتائج
    const resultsQuery = new Parse.Query(FerrisWheelResults);
    resultsQuery.descending("round");
    resultsQuery.limit(10);
    const recentResults = await resultsQuery.find({ useMasterKey: true });
    const resultList = recentResults.map(r => r.get("result"));

    // جلب رهانات المستخدم الحالية
    const currentBetsQuery = new Parse.Query(FerrisWheelChoices);
    currentBetsQuery.equalTo("userId", userId);
    currentBetsQuery.equalTo("round", currentRound);
    const currentBets = await currentBetsQuery.find({ useMasterKey: true });

    const selectMap = {};
    for (const bet of currentBets) {
        selectMap[bet.get("choice")] = bet.get("gold");
    }

    // حساب أرباح المستخدم من الجولة السابقة
    let winGold = 0;
    
    if (previousWinningFruit && currentRound > 0) {
        const userWinQuery = new Parse.Query(FerrisWheelChoices);
        userWinQuery.equalTo("userId", userId);
        userWinQuery.equalTo("round", currentRound - 1);
        userWinQuery.equalTo("choice", previousWinningFruit);
        const userWinBet = await userWinQuery.first({ useMasterKey: true });
        
        if (userWinBet) {
            winGold = Math.floor(userWinBet.get("gold") * FRUIT_MULTIPLIERS[previousWinningFruit]);
        }
    }

    // فرز القائمة العليا حسب الإجمالي
    topList.sort((a, b) => b.total - a.total);
    
    // إحصائيات الربحية الحالية
    const currentProfitMargin = profitSystem.getCurrentProfitMargin();

    return {
        code: 200,
        message: "Success",
        data: {
            countdown: countdown,
            round: currentRound,
            gold: userCredits,
            profit: userProfit,
            result: previousWinningFruit,
            resultList: resultList,
            select: selectMap,
            top: topList.slice(0, 3),
            winGold: winGold,
            avatar: userAvatar,
            nickname: userNickname,
            profitStats: {
                systemProfitMargin: (currentProfitMargin * 100).toFixed(2) + '%',
                targetMargin: '70%',
                systemProfit: profitSystem.systemProfit,
                totalBets: profitSystem.totalBets
            }
        }
    };
});

//////////////////////////////////////////////////////////
// وضع رهان في اللعبة - مع نظام الربحية
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_choice", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    const { choice, gold } = request.params;
    const userId = user.id;

    // التحقق من صحة البيانات
    if (!choice || gold <= 0) {
        return { code: 400, message: "Invalid input data" };
    }

    if (!FRUIT_MULTIPLIERS[choice]) {
        return { code: 400, message: "Invalid fruit choice" };
    }

    // حساب الجولة الحالية
    const currentTime = Math.floor(Date.now() / 1000);
    const currentRound = Math.floor(currentTime / ROUND_DURATION);

    // التحقق من رصيد المستخدم
    await user.fetch({ useMasterKey: true });
    const userCredits = user.get("credit") || 0;

    if (userCredits < gold) {
        return { code: 10062, message: "Insufficient balance" };
    }

    // خصم الرصيد
    user.increment("credit", -gold);
    await user.save(null, { useMasterKey: true });

    // التحقق من وجود رهان سابق على نفس الفاكهة
    const existingBetQuery = new Parse.Query(FerrisWheelChoices);
    existingBetQuery.equalTo("userId", userId);
    existingBetQuery.equalTo("round", currentRound);
    existingBetQuery.equalTo("choice", choice);
    const existingBet = await existingBetQuery.first({ useMasterKey: true });

    if (existingBet) {
        // تحديث الرهان السابق
        existingBet.increment("gold", gold);
        await existingBet.save(null, { useMasterKey: true });
    } else {
        // إضافة رهان جديد
        const newBet = new FerrisWheelChoices();
        newBet.set("userId", userId);
        newBet.set("user", user);
        newBet.set("round", currentRound);
        newBet.set("choice", choice);
        newBet.set("gold", gold);
        await newBet.save(null, { useMasterKey: true });
    }

    // إرجاع الرصيد المحدث
    await user.fetch({ useMasterKey: true });
    const newBalance = user.get("credit") || 0;

    return {
        code: 200,
        message: "Bet placed successfully",
        balance: newBalance,
        choice: choice,
        gold: gold
    };
});

//////////////////////////////////////////////////////////
// جلب سجل الرهانات
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_bill", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    const userId = user.id;

    const billsQuery = new Parse.Query(FerrisWheelChoices);
    billsQuery.equalTo("userId", userId);
    billsQuery.descending("createdAt");
    billsQuery.limit(10);
    billsQuery.include(["user"]);
    const bills = await billsQuery.find({ useMasterKey: true });

    const billData = [];
    for (const bill of bills) {
        const round = bill.get("round");
        const choice = bill.get("choice");
        const gold = bill.get("gold") || 0;
        
        // جلب نتيجة الجولة
        const resultQuery = new Parse.Query(FerrisWheelResults);
        resultQuery.equalTo("round", round);
        const result = await resultQuery.first({ useMasterKey: true });
        
        const resultFruit = result ? result.get("result") : null;
        
        billData.push({
            gold: gold,
            choice: choice,
            result: resultFruit,
            createTime: bill.createdAt,
        });
    }

    return {
        code: 200,
        message: "Success",
        data: billData
    };
});

//////////////////////////////////////////////////////////
// جلب ترتيب اللاعبين - محسنة
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_rank", async (request) => {
    const rankQuery = new Parse.Query(Parse.User);
    rankQuery.descending("credit");
    rankQuery.limit(10);
    rankQuery.select(["username", "avatar", "credit", "first_name", "last_name"]);
    
    try {
        const topUsers = await rankQuery.find({ useMasterKey: true });

        const rankList = [];
        for (const user of topUsers) {
            await user.fetch({ useMasterKey: true });
            const avatar = getImageUrl(user.get("avatar"));
            const nickname = getNickname(user);
            
            rankList.push({
                id: user.id,
                uid: user.id,
                nick: nickname,
                avatar: avatar,
                total: user.get("credit") || 0,
            });
        }

        return {
            code: 200,
            message: "Success",
            data: rankList
        };
    } catch (error) {
        console.error("Rank error:", error);
        return {
            code: 500,
            message: "Error fetching rank data",
            data: []
        };
    }
});

//////////////////////////////////////////////////////////
// التحقق من صلاحية اللاعب للعبة - محسنة
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_validate_player", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    await user.fetch({ useMasterKey: true });

    const avatar = getImageUrl(user.get("avatar"));
    const nickname = getNickname(user);
    
    console.log(`✅ Validating player: ${nickname}, Avatar: ${avatar ? 'Found' : 'Not found'}`);
    
    return {
        code: 200,
        message: "Valid player",
        data: {
            userId: user.id,
            uid: user.id,
            username: user.get("username"),
            nickname: nickname,
            avatar: avatar,
            credits: user.get("credit") || 0,
            diamonds: user.get("diamonds") || 0,
            language: user.get("language") || 'en',
        }
    };
});

//////////////////////////////////////////////////////////
// إعادة تعيين اللعبة (للتطوير فقط)
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_reset", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    const userId = user.id;
    
    // حذف جميع رهانات المستخدم
    const deleteBetsQuery = new Parse.Query(FerrisWheelChoices);
    deleteBetsQuery.equalTo("userId", userId);
    const userBets = await deleteBetsQuery.find({ useMasterKey: true });
    
    if (userBets.length > 0) {
        await Parse.Object.destroyAll(userBets, { useMasterKey: true });
    }
    
    // إعادة تعيين الأرباح
    user.set("gameProfit", 0);
    await user.save(null, { useMasterKey: true });
    
    return {
        code: 200,
        message: "Game reset successfully"
    };
});

//////////////////////////////////////////////////////////
// دوال إضافية مفيدة
//////////////////////////////////////////////////////////

// الحصول على إحصائيات المستخدم
Parse.Cloud.define("getUserStats", async (request) => {
    const user = request.user;
    if (!user) {
        throw new Parse.Error(Parse.Error.SESSION_MISSING, "User not authenticated");
    }

    await user.fetch({ useMasterKey: true });
    
    return {
        success: true,
        stats: {
            userId: user.id,
            username: user.get("username"),
            nickname: getNickname(user),
            avatar: getImageUrl(user.get("avatar")),
            credits: user.get("credit") || 0,
            diamonds: user.get("diamonds") || 0,
            gameProfit: user.get("gameProfit") || 0,
            followers: (user.get("followers") || []).length,
            following: (user.get("following") || []).length,
            lastOnline: user.get("lastOnline"),
            createdAt: user.createdAt
        }
    };
});

// تحديث صورة الملف الشخصي
Parse.Cloud.define("updateAvatar", async (request) => {
    const user = request.user;
    const { avatarUrl } = request.params;
    
    if (!user) {
        throw new Parse.Error(Parse.Error.SESSION_MISSING, "User not authenticated");
    }
    
    if (!avatarUrl) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Avatar URL is required");
    }
    
    user.set("avatar", avatarUrl);
    await user.save(null, { useMasterKey: true });
    
    return {
        success: true,
        message: "Avatar updated successfully",
        avatar: getImageUrl(user.get("avatar"))
    };
});

//////////////////////////////////////////////////////////
// =================== دوال التحكم والإحصائيات ===================
//////////////////////////////////////////////////////////

/**
 * جلب تقرير الربحية للمشرفين
 */
Parse.Cloud.define("admin_profit_report", async (request) => {
    const user = request.user;
    
    // التحقق من صلاحية المشرف
    const isAdmin = user.get("isAdmin") || user.get("role") === "admin";
    if (!isAdmin) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Admin access required");
    }
    
    const days = request.params.days || 7;
    
    // إحصائيات الربحية
    const profitReport = profitSystem.getProfitReport(days);
    
    // جلب آخر 20 نتيجة
    const recentResultsQuery = new Parse.Query(FerrisWheelResults);
    recentResultsQuery.descending("round");
    recentResultsQuery.limit(20);
    const recentResults = await recentResultsQuery.find({ useMasterKey: true });
    
    // إحصائيات الفواكه
    const fruitStats = {};
    const allResults = await new Parse.Query(FerrisWheelResults)
        .limit(1000)
        .find({ useMasterKey: true });
    
    allResults.forEach(result => {
        const fruit = result.get("result");
        if (fruit) {
            if (!fruitStats[fruit]) {
                fruitStats[fruit] = {
                    count: 0,
                    multiplier: FRUIT_MULTIPLIERS[fruit] || 0
                };
            }
            fruitStats[fruit].count++;
        }
    });
    
    return {
        code: 0,
        data: {
            // أ. ملخص النظام
            systemSummary: {
                totalRounds: profitReport.totalRounds,
                totalBets: profitReport.totalBets,
                totalPayout: profitReport.totalPayout,
                systemProfit: profitReport.systemProfit,
                profitMargin: (profitReport.averageProfitMargin * 100).toFixed(2) + '%',
                targetMargin: '70%',
                deviation: ((profitReport.averageProfitMargin - 0.7) * 100).toFixed(2) + '%',
                status: Math.abs(profitReport.averageProfitMargin - 0.7) < 0.05 ? 'OPTIMAL' : 'NEEDS_ADJUSTMENT'
            },
            
            // ب. التقارير اليومية
            dailyReports: profitReport.reports,
            
            // ج. النتائج الأخيرة
            recentResults: recentResults.map(result => ({
                round: result.get("round"),
                fruit: result.get("result"),
                multiplier: FRUIT_MULTIPLIERS[result.get("result")] || 0,
                createdAt: result.createdAt
            })),
            
            // د. إحصائيات الفواكه
            fruitStatistics: Object.entries(fruitStats).map(([fruit, stats]) => ({
                fruit: fruit,
                occurrences: stats.count,
                occurrenceRate: allResults.length > 0 ? ((stats.count / allResults.length) * 100).toFixed(2) + '%' : '0%',
                multiplier: stats.multiplier,
                expectedRate: stats.multiplier === 45 ? '1-2%' : stats.multiplier === 25 ? '5-10%' : '10-15%'
            })),
            
            // هـ. المضاعفات الحالية
            currentMultipliers: FRUIT_MULTIPLIERS,
            
            // و. إحصائيات النظام الذكي
            smartSystemStats: {
                totalRoundsTracked: profitSystem.roundStats.length,
                currentProfitMargin: (profitSystem.getCurrentProfitMargin() * 100).toFixed(2) + '%',
                fruitPerformance: profitController.fruitStats
            }
        }
    };
});

/**
 * تعديل المضاعفات يدوياً
 */
Parse.Cloud.define("admin_adjust_multipliers", async (request) => {
    const user = request.user;
    const { adjustments, reason } = request.params;
    
    if (!user || !user.get("isAdmin")) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Admin access required");
    }
    
    // هذا مثال، في النظام الحقيقي المضاعفات ثابتة
    // يمكنك إضافة منطق لتخزين المضاعفات المعدلة
    
    return {
        success: true,
        message: "Multipliers are fixed in this system. Use profit control system to adjust winning fruits.",
        currentMultipliers: FRUIT_MULTIPLIERS,
        note: "System automatically selects winning fruits to achieve 70% profit margin"
    };
});

/**
 * إعادة تعيين إحصائيات الربحية
 */
Parse.Cloud.define("admin_reset_profit_stats", async (request) => {
    const user = request.user;
    
    if (!user || !user.get("isAdmin")) {
        throw new Parse.Error(Parse.Error.INVALID_QUERY, "Admin access required");
    }
    
    const { confirm } = request.params;
    
    if (confirm !== "RESET_STATS_123") {
        throw new Parse.Error(400, "Confirmation code required");
    }
    
    // إعادة تعيين الإحصائيات
    profitSystem.dailyStats = {};
    profitSystem.roundStats = [];
    profitSystem.systemProfit = 0;
    profitSystem.totalBets = 0;
    profitSystem.totalPayout = 0;
    
    // إعادة تعيين إحصائيات الفواكه
    profitController.initializeFruitStats();
    
    return {
        success: true,
        message: "Profit statistics reset successfully",
        resetTime: new Date()
    };
});

//////////////////////////////////////////////////////////
// =================== هوكس النظام ===================
//////////////////////////////////////////////////////////

// قبل تسجيل الدخول
Parse.Cloud.beforeLogin(async (request) => {
    const user = request.object;

    if (user.get("accountDeleted")) {
        throw new Parse.Error(340, "Account Deleted");
    }

    if (user.get("activationStatus")) {
        throw new Parse.Error(341, "Access denied, you have been blocked.");
    }
    
    // تحديث آخر وقت ظهور
    user.set("lastOnline", new Date());
});

Parse.Cloud.beforeSave(Parse.User, async (request) => {
  request.context = request.context || {};
  request.context.useMasterKey = true;
});

//////////////////////////////////////////////////////////
// =================== النهاية ===================
//////////////////////////////////////////////////////////

console.log("✅ Cloud Code loaded successfully!");
console.log("🎮 Game System: ACTIVE");
console.log("💰 Profit Control: 70% System, 40% Users");
console.log("📊 Statistics System: ENABLED");
console.log("🎯 Smart Fruit Selection: ENABLED");
