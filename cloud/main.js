// ==========================================
// Parse Cloud Code - Main Application
// ==========================================

const OneSignal = require('@onesignal/node-onesignal');

// OneSignal config
const app_id = "7dec5bab-5550-4977-af9d-563e58d64721";
const user_key_token = "os_v2_app_pxwfxk2vkbexpl45ky7frvsheejjt5vfgk2udcetlfdjqmpkgmuxzghyhf3dzqm5njoioddsruaoqezy6n7puoxdohswdeanxdc32qa";
const rest_api_key = "os_v2_app_pxwfxk2vkbexpl45ky7frvsheejjt5vfgk2udcetlfdjqmpkgmuxzghyhf3dzqm5njoioddsruaoqezy6n7puoxdohswdeanxdc32qa";

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;

const configuration = OneSignal.createConfiguration({
  userAuthKey: user_key_token,
  restApiKey: rest_api_key,
});
const client = new OneSignal.DefaultApi(configuration);

//////////////////////////////////////////////////////////
// =================== دوال المساعدة ===================
//////////////////////////////////////////////////////////

/**
 * استخراج رابط الصورة من بيانات Parse File - محسنة
 */
function getImageUrl(avatarData) {
    console.log("🔍 getImageUrl called with:", typeof avatarData, avatarData);
    
    if (!avatarData) {
        console.log("❌ No avatar data provided");
        return '';
    }
    
    // 1. إذا كان object يحتوي على url
    if (typeof avatarData === 'object' && avatarData !== null) {
        console.log("📦 Avatar is object:", avatarData);
        
        // إذا كان Parse File object
        if (avatarData.url) {
            console.log("✅ Found URL in object:", avatarData.url);
            return avatarData.url;
        }
        
        // إذا كان يحتوي على _url
        if (avatarData._url) {
            console.log("✅ Found _url in object:", avatarData._url);
            return avatarData._url;
        }
        
        // تحويل الكائن إلى JSON واستخراج URL
        try {
            const jsonStr = JSON.stringify(avatarData);
            console.log("🔄 Object JSON string:", jsonStr);
            
            if (jsonStr.includes('"url":')) {
                const urlMatch = jsonStr.match(/"url"\s*:\s*"([^"]+)"/);
                if (urlMatch && urlMatch[1]) {
                    console.log("✅ Extracted URL from object JSON:", urlMatch[1]);
                    return urlMatch[1];
                }
            }
        } catch (e) {
            console.error("❌ Error processing object:", e);
        }
    }
    
    // 2. إذا كان string
    if (typeof avatarData === 'string') {
        console.log("📝 Avatar is string:", avatarData);
        
        // إذا كان URL مباشر
        if (avatarData.startsWith('http://') || avatarData.startsWith('https://')) {
            console.log("✅ Direct URL:", avatarData);
            return avatarData;
        }
        
        // إذا كان يحتوي على File object كـ JSON
        try {
            // تنظيف السلسلة لتحليل JSON
            let cleanStr = avatarData;
            
            // استبدال الاقتباسات المفردة بمزدوجة للتحليل الصحيح
            if (avatarData.includes("'") && !avatarData.includes('"')) {
                cleanStr = avatarData.replace(/'/g, '"');
            }
            
            // إزالة backslashes
            cleanStr = cleanStr.replace(/\\/g, '');
            
            console.log("🔄 Cleaned string for JSON parsing:", cleanStr);
            
            const parsed = JSON.parse(cleanStr);
            console.log("✅ Parsed JSON:", parsed);
            
            if (parsed && parsed.url) {
                console.log("✅ Found URL in parsed JSON:", parsed.url);
                return parsed.url;
            }
            
            if (parsed && parsed._url) {
                console.log("✅ Found _url in parsed JSON:", parsed._url);
                return parsed._url;
            }
        } catch (e) {
            console.log("⚠️ Not valid JSON, trying regex extraction");
            
            // محاولة استخراج URL باستخدام regex
            const urlRegex = /(https?:\/\/[^\s"']+)/;
            const match = avatarData.match(urlRegex);
            if (match && match[1]) {
                console.log("✅ Extracted URL with regex:", match[1]);
                return match[1];
            }
            
            // إذا كان يحتوي على name فقط، بناء الرابط
            if (avatarData.includes('_avatar') || avatarData.includes('.jpg') || avatarData.includes('.png')) {
                const url = `https://parse410.onrender.com/parse/files/spp111424242ssdsd/${avatarData}`;
                console.log("🔗 Built URL from filename:", url);
                return url;
            }
        }
    }
    
    console.log("❌ Could not extract image URL");
    return '';
}

/**
 * استخراج اسم المستخدم من بيانات المستخدم - محسنة
 */
function getNickname(user) {
    if (!user) return 'Unknown User';
    
    console.log("👤 getNickname called for user:", user.id);
    
    // أولاً: التحقق من first_name (ولكن ليس إذا كانت objectId)
    const firstName = user.get('first_name');
    if (firstName && firstName !== user.id && firstName !== user.get('username')) {
        const lastName = user.get('last_name') || '';
        const name = firstName + (lastName ? ' ' + lastName : '');
        console.log("✅ Using first_name + last_name:", name);
        return name;
    }
    
    // ثانياً: username
    const username = user.get('username');
    if (username) {
        console.log("✅ Using username:", username);
        return username;
    }
    
    // ثالثاً: name
    const name = user.get('name');
    if (name) {
        console.log("✅ Using name field:", name);
        return name;
    }
    
    // رابعاً: objectId مختصر
    const shortId = user.id.substring(0, 6);
    console.log("✅ Using objectId (short):", `User_${shortId}`);
    return `User_${shortId}`;
}

//////////////////////////////////////////////////////////
// =================== دوال التطبيق الرئيسية ===================
//////////////////////////////////////////////////////////
Parse.Cloud.beforeSave(Parse.User, async (request) => {
  request.context = request.context || {};
  request.context.useMasterKey = true;
});

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

//////////////////////////////////////////////////////////
// =================== GAMES API ===================
//////////////////////////////////////////////////////////

// تعريف الفئات
const FerrisWheelChoices = Parse.Object.extend("FerrisWheelChoices");
const FerrisWheelResults = Parse.Object.extend("FerrisWheelResults");

// إعدادات اللعبة
const ROUND_DURATION = 45; // مدة الجولة بالثواني
const FRUIT_MULTIPLIERS = {
    'g': 45,
    'h': 5,
    'a': 5,
    'b': 5,
    'c': 5,
    'd': 10,
    'e': 15,
    'f': 25,
};

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

//////////////////////////////////////////////////////////
// جلب معلومات اللعبة والجولة الحالية - محسنة
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_info", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    const userId = user.id;
    console.log(`🎮 Game info requested for user: ${userId}`);
    
    // 🔥 التعديل الذهبي: جلب البيانات مع حقل avatar
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
    
    // 🔥 التعديل المهم: استخراج الصورة والاسم بعد fetch
    const userAvatar = getImageUrl(user.get("avatar"));
    const userNickname = getNickname(user);
    
    console.log(`👤 User data - Avatar: ${userAvatar ? 'Found' : 'Not found'}, Nickname: ${userNickname}`);

    // التحقق من نتيجة الجولة السابقة
    const lastResultQuery = new Parse.Query(FerrisWheelResults);
    lastResultQuery.equalTo("round", currentRound - 1);
    let lastResult = await lastResultQuery.first({ useMasterKey: true });

    let previousWinningFruit = null;
    let topList = [];

    if (!lastResult && currentRound > 0) {
        // اختيار الفاكهة الرابحة عشوائياً
        const fruitKeys = Object.keys(FRUIT_MAP);
        const winningNumber = fruitKeys[Math.floor(Math.random() * fruitKeys.length)];
        previousWinningFruit = FRUIT_MAP[winningNumber];

        // تسجيل نتيجة الجولة السابقة
        const newResult = new FerrisWheelResults();
        newResult.set("round", currentRound - 1);
        newResult.set("result", previousWinningFruit);
        await newResult.save(null, { useMasterKey: true });

        // تحديث أرباح الفائزين
        const previousBetsQuery = new Parse.Query(FerrisWheelChoices);
        previousBetsQuery.equalTo("round", currentRound - 1);
        previousBetsQuery.equalTo("choice", previousWinningFruit);
        const winningBets = await previousBetsQuery.find({ useMasterKey: true });

        for (const bet of winningBets) {
            const betUserId = bet.get("userId");
            const betGold = bet.get("gold") || 0;
            const winAmount = Math.floor(betGold * FRUIT_MULTIPLIERS[previousWinningFruit]);

            // 🔥 جلب بيانات المستخدم الفائز مع avatar
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

            // 🔥 جلب بيانات المستخدم الفائز مع avatar
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
        }
    };
});

//////////////////////////////////////////////////////////
// وضع رهان في اللعبة
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
            // 🔥 جلب البيانات مع avatar
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

    // 🔥 التعديل الذهبي: جلب البيانات مع حقل avatar
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

    // فقط للأغراض التنموية
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

console.log("✅ Cloud Code loaded successfully with enhanced image handling!");
