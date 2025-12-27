// ==========================================
// Parse Cloud Code - Advanced Examples
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
// =================== مساعدة - إصلاح مسارات الصور ===================
//////////////////////////////////////////////////////////

/**
 * استخراج رابط الصورة من بيانات Parse File
 */
function getImageUrl(avatarData) {
    if (!avatarData) return '';
    
    // إذا كان avatarData هو object يحتوي على url
    if (typeof avatarData === 'object' && avatarData.url) {
        return avatarData.url;
    }
    
    // إذا كان avatarData هو string
    if (typeof avatarData === 'string') {
        // تحقق إذا كان يحتوي على http
        if (avatarData.startsWith('http://') || avatarData.startsWith('https://')) {
            return avatarData;
        }
        
        // إذا كان يحتوي على File object كـ JSON
        try {
            const parsed = JSON.parse(avatarData);
            if (parsed && parsed.url) {
                return parsed.url;
            }
        } catch (e) {
            // ليس JSON، عوده كما هو
            return avatarData;
        }
    }
    
    return '';
}

/**
 * استخراج اسم المستخدم من بيانات المستخدم
 */
function getNickname(user) {
    if (user.get('name')) {
        return user.get('name');
    }
    
    if (user.get('username')) {
        return user.get('username');
    }
    
    if (user.get('first_name')) {
        const firstName = user.get('first_name');
        const lastName = user.get('last_name') || '';
        return firstName + (lastName ? ' ' + lastName : '');
    }
    
    return `User_${user.id.substring(0, 6)}`;
}

//////////////////////////////////////////////////////////
// Send Push Notification
//////////////////////////////////////////////////////////
Parse.Cloud.define('sendPush', async (request) => {
    var userQuery = new Parse.Query(Parse.User);
    
    if(request.params.type == "live"){
        userQuery.containedIn("objectId", request.params.followers);
    } else {
        userQuery.equalTo("objectId", request.params.receiverId);
    }

    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.matchesQuery('user', userQuery);

    const notification = new OneSignal.Notification();
    notification.app_id = app_id;
    notification.headings = { en: request.params.title};  
    notification.contents = { en: request.params.alert};
    notification.large_icon = request.params.avatar;
    notification.big_picture = request.params.big_picture;
    notification.target_channel = "Push";
    notification.include_aliases = {
        external_id: [request.params.receiverId]
    };  
    notification.data = {
        view: request.params.view,
        alert: request.params.alert,
        senderId: request.params.senderId,
        senderName: request.params.senderName,
        type: request.params.type,
        chat: request.params.chat,
        avatar: request.params.avatar,
        objectId: request.params.objectId,
    };  

    return client.createNotification(notification)
        .then(function () {
            console.log("Push successfully");
            return "sent";
        }, function (error) {
            console.log("Push Got an error " + error.code + " : " + error.message);
            return Promise.reject(error);
        });
});

//////////////////////////////////////////////////////////
// Update Password
//////////////////////////////////////////////////////////
Parse.Cloud.define("updatePassword", async (request) => {
    const { username, password } = request.params;

    const userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo("username", username);

    const user = await userQuery.first({ useMasterKey: true });
    if (!user) throw "User not found";

    user.set("password", password);
    user.set("secondary_password", password);
    await user.save(null, { useMasterKey: true });

    return "updated";
});

//////////////////////////////////////////////////////////
// Send Gift
//////////////////////////////////////////////////////////
Parse.Cloud.define("send_gift", async (request) => {
    const { objectId, credits } = request.params;

    const user = await new Parse.Query(Parse.User).get(objectId, { useMasterKey: true });

    user.increment("diamonds", credits);
    user.increment("diamondsTotal", credits);

    await user.save(null, { useMasterKey: true });
    return "updated";
});

//////////////////////////////////////////////////////////
// Send Agency Gift
//////////////////////////////////////////////////////////
Parse.Cloud.define("send_agency", async (request) => {
    const { objectId, credits } = request.params;

    const user = await new Parse.Query(Parse.User).get(objectId, { useMasterKey: true });

    user.increment("diamondsAgency", credits);
    user.increment("diamondsAgencyTotal", credits);

    await user.save(null, { useMasterKey: true });
    return "updated";
});

//////////////////////////////////////////////////////////
// Check phone number
//////////////////////////////////////////////////////////
Parse.Cloud.define("check_phone_number", async (request) => {
    const phone = request.params.phone_number;

    const user = await new Parse.Query(Parse.User)
        .equalTo("phone_number_full", phone)
        .first({ useMasterKey: true });

    if (user) throw new Parse.Error(100, "Phone exists");
    return "ok";
});

//////////////////////////////////////////////////////////
// Restart PK Battle
//////////////////////////////////////////////////////////
Parse.Cloud.define("restartPkBattle", async (request) => {
    const { liveChannel, times } = request.params;

    const live = await new Parse.Query("Streaming")
        .equalTo("streaming_channel", liveChannel)
        .equalTo("streaming", true)
        .equalTo("battle_status", "battle_alive")
        .first();

    if (!live) throw "Streaming not found";

    live.set("his_points", 0);
    live.set("my_points", 0);
    live.set("repeat_battle_times", times);

    await live.save();
});

//////////////////////////////////////////////////////////
// Save his battle points
//////////////////////////////////////////////////////////
Parse.Cloud.define("save_hisBattle_points", async (request) => {
    const { points, liveChannel } = request.params;

    const live = await new Parse.Query("Streaming")
        .equalTo("streaming_channel", liveChannel)
        .equalTo("streaming", true)
        .equalTo("battle_status", "battle_alive")
        .first();

    if (!live) throw "Streaming not found";

    live.set("his_points", points);
    await live.save();
});

//////////////////////////////////////////////////////////
// Follow user
//////////////////////////////////////////////////////////
Parse.Cloud.define("follow_user", async (request) => {
    const { authorId, receiverId } = request.params;

    const author = await new Parse.Query(Parse.User).get(authorId, { useMasterKey: true });
    const receiver = await new Parse.Query(Parse.User).get(receiverId, { useMasterKey: true });

    author.addUnique("following", receiverId);
    receiver.addUnique("followers", authorId);

    await author.save(null, { useMasterKey: true });
    await receiver.save(null, { useMasterKey: true });

    return author;
});

//////////////////////////////////////////////////////////
// Unfollow user
//////////////////////////////////////////////////////////
Parse.Cloud.define("unfollow_user", async (request) => {
    const { authorId, receiverId } = request.params;

    const author = await new Parse.Query(Parse.User).get(authorId, { useMasterKey: true });
    const receiver = await new Parse.Query(Parse.User).get(receiverId, { useMasterKey: true });

    author.remove("following", receiverId);
    receiver.remove("followers", authorId);

    await author.save(null, { useMasterKey: true });
    await receiver.save(null, { useMasterKey: true });

    return author;
});

//////////////////////////////////////////////////////////
// RevenueCat verify + add coins
//////////////////////////////////////////////////////////
Parse.Cloud.define("verifyAndAddCoins", async (request) => {
    const { userId, productId, transactionId, purchaseDate } = request.params;

    const user = request.user;
    if (!user || user.id !== userId) {
        throw new Parse.Error(209, "Unauthorized");
    }

    const PaymentsModel = Parse.Object.extend("PaymentsModel");

    const exists = await new Parse.Query(PaymentsModel)
        .equalTo("transactionId", transactionId)
        .first({ useMasterKey: true });

    if (exists) throw new Parse.Error(141, "Duplicate transaction");

    const url = `https://api.revenuecat.com/v1/subscribers/${userId}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${REVENUECAT_API_KEY}` }
    });

    if (!res.ok) throw new Parse.Error(141, "RevenueCat error");

    const data = await res.json();

    const transactions = data.subscriber?.non_subscriptions?.[productId] || [];
    const verifiedTx = transactions.find(tx => tx.id === transactionId);

    if (!verifiedTx) throw new Parse.Error(141, "Invalid transaction");

    const match = productId.match(/flamingo\.(\d+)\.credits/);
    if (!match) throw new Parse.Error(141, "Invalid product format");

    const coins = parseInt(match[1], 10);

    user.set("credit", (user.get("credit") || 0) + coins);
    await user.save(null, { useMasterKey: true });

    const payment = new PaymentsModel();
    payment.set("author", user);
    payment.set("authorId", userId);
    payment.set("transactionId", transactionId);
    payment.set("productId", productId);
    payment.set("coins", coins);
    payment.set("purchaseDate", purchaseDate);
    payment.set("paymentType", "coins");
    payment.set("status", "completed");

    await payment.save(null, { useMasterKey: true });

    return { success: true, coinsAdded: coins, userId };
});

//////////////////////////////////////////////////////////
// Before Login Hook
//////////////////////////////////////////////////////////
Parse.Cloud.beforeLogin(async (request) => {
    const user = request.object;

    if (user.get("accountDeleted")) {
        throw new Parse.Error(340, "Account Deleted");
    }

    if (user.get("activationStatus")) {
        throw new Parse.Error(341, "Access denied, you have been blocked.");
    }
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
// جلب معلومات اللعبة والجولة الحالية
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_info", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    const userId = user.id;
    
    // حساب الجولة الحالية
    const currentTime = Math.floor(Date.now() / 1000);
    const currentRound = Math.floor(currentTime / ROUND_DURATION);
    const roundStartTime = currentRound * ROUND_DURATION;
    const roundEndTime = roundStartTime + ROUND_DURATION;
    const countdown = Math.max(0, roundEndTime - currentTime);

    // جلب بيانات المستخدم
    await user.fetch({ useMasterKey: true });
    const userCredits = user.get("credit") || 0;
    const userProfit = user.get("gameProfit") || 0;
    const userAvatar = getImageUrl(user.get("avatar"));
    const userNickname = getNickname(user);

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

            const betUser = await new Parse.Query(Parse.User).get(betUserId, { useMasterKey: true });
            if (betUser) {
                betUser.increment("credit", winAmount);
                betUser.increment("gameProfit", winAmount);
                await betUser.save(null, { useMasterKey: true });

                // إضافة للقائمة العليا
                const betUserAvatar = getImageUrl(betUser.get("avatar"));
                const betUserNickname = getNickname(betUser);
                
                topList.push({
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

            const betUser = await new Parse.Query(Parse.User).get(betUserId, { useMasterKey: true });
            if (betUser) {
                const betUserAvatar = getImageUrl(betUser.get("avatar"));
                const betUserNickname = getNickname(betUser);
                
                topList.push({
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
        balance: newBalance
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
// جلب ترتيب اللاعبين
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_rank", async (request) => {
    const rankQuery = new Parse.Query(Parse.User);
    rankQuery.descending("credit");
    rankQuery.limit(10);
    rankQuery.select(["name", "username", "avatar", "credit", "first_name", "last_name"]);
    
    try {
        const topUsers = await rankQuery.find({ useMasterKey: true });

        const rankList = topUsers.map(user => {
            const avatar = getImageUrl(user.get("avatar"));
            const nickname = getNickname(user);
            
            return {
                id: user.id,
                nick: nickname,
                avatar: avatar,
                total: user.get("credit") || 0,
            };
        });

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
// التحقق من صلاحية اللاعب للعبة
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_validate_player", async (request) => {
    const user = request.user;
    if (!user) {
        return { code: 700, message: "User not authenticated" };
    }

    await user.fetch({ useMasterKey: true });

    const avatar = getImageUrl(user.get("avatar"));
    const nickname = getNickname(user);
    
    return {
        code: 200,
        message: "Valid player",
        data: {
            userId: user.id,
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
    
    await Parse.Object.destroyAll(userBets, { useMasterKey: true });
    
    // إعادة تعيين الأرباح
    user.set("gameProfit", 0);
    await user.save(null, { useMasterKey: true });
    
    return {
        code: 200,
        message: "Game reset successfully"
    };
});

//////////////////////////////////////////////////////////
// توليد نتائج اختبارية
//////////////////////////////////////////////////////////
Parse.Cloud.define("game_generate_test_data", async (request) => {
    // فقط للأغراض التنموية
    const { rounds } = request.params;
    const numRounds = rounds || 10;
    
    const fruits = ['g', 'h', 'a', 'b', 'c', 'd', 'e', 'f'];
    
    for (let i = 1; i <= numRounds; i++) {
        const randomFruit = fruits[Math.floor(Math.random() * fruits.length)];
        
        const result = new FerrisWheelResults();
        result.set("round", i);
        result.set("result", randomFruit);
        await result.save(null, { useMasterKey: true });
    }
    
    return {
        code: 200,
        message: `Generated ${numRounds} test rounds`
    };
});
// 2. دالة Cloud مع معاملات
Parse.Cloud.define("greet", (request) => {
  const { name } = request.params;
  return `Hello, ${name}!`;
});

// 3. دالة Cloud مع قاعدة البيانات
Parse.Cloud.define("getUserCount", async (request) => {
  const query = new Parse.Query(Parse.User);
  const count = await query.count();
  return { userCount: count };
});

// 4. دالة Cloud مع الصلاحيات الكاملة
Parse.Cloud.define("createObject", async (request) => {
  const { className, data } = request.params;
  const object = new Parse.Object(className);
  
  // تعيين البيانات
  for (const key in data) {
    object.set(key, data[key]);
  }
  
  // حفظ مع صلاحيات كاملة
  await object.save(null, { useMasterKey: true });
  return { success: true, objectId: object.id };
});

// 5. دالة Cloud للبحث
Parse.Cloud.define("search", async (request) => {
  const { className, key, value } = request.params;
  const query = new Parse.Query(className);
  query.equalTo(key, value);
  const results = await query.find({ useMasterKey: true });
  return results;
});

// 6. دالة Cloud للتحديث
Parse.Cloud.define("updateObject", async (request) => {
  const { className, objectId, data } = request.params;
  const query = new Parse.Query(className);
  const object = await query.get(objectId, { useMasterKey: true });
  
  // تحديث البيانات
  for (const key in data) {
    object.set(key, data[key]);
  }
  
  await object.save(null, { useMasterKey: true });
  return { success: true, objectId: object.id };
});

// 7. دالة Cloud للحذف
Parse.Cloud.define("deleteObject", async (request) => {
  const { className, objectId } = request.params;
  const query = new Parse.Query(className);
  const object = await query.get(objectId, { useMasterKey: true });
  await object.destroy({ useMasterKey: true });
  return { success: true, message: 'Object deleted' };
});

// 8. دالة Cloud للاستعلام المتقدم
Parse.Cloud.define("advancedQuery", async (request) => {
  const { className, where, limit = 100, skip = 0 } = request.params;
  const query = new Parse.Query(className);
  
  // تطبيق الشروط
  if (where) {
    for (const key in where) {
      const condition = where[key];
      if (condition.$gt !== undefined) query.greaterThan(key, condition.$gt);
      if (condition.$lt !== undefined) query.lessThan(key, condition.$lt);
      if (condition.$eq !== undefined) query.equalTo(key, condition.$eq);
      if (condition.$ne !== undefined) query.notEqualTo(key, condition.$ne);
    }
  }
  
  query.limit(limit);
  query.skip(skip);
  
  const results = await query.find({ useMasterKey: true });
  return {
    count: results.length,
    results: results
  };
});

// 9. Hook - قبل الحفظ
Parse.Cloud.beforeSave("GameScore", (request) => {
  const object = request.object;
  
  // التحقق من الصحة
  if (object.get("score") < 0) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, "Score cannot be negative");
  }
  
  // إضافة timestamp
  object.set("lastModified", new Date());
});

// 10. Hook - بعد الحفظ
Parse.Cloud.afterSave("GameScore", (request) => {
  console.log(`GameScore saved: ${request.object.id}`);
});

// 11. Hook - قبل الحذف
Parse.Cloud.beforeDelete("GameScore", (request) => {
  console.log(`GameScore will be deleted: ${request.object.id}`);
});

// 12. Hook - بعد الحذف
Parse.Cloud.afterDelete("GameScore", (request) => {
  console.log(`GameScore deleted: ${request.object.id}`);
});

// 13. دالة Cloud للإحصائيات
Parse.Cloud.define("getStats", async (request) => {
  const { className } = request.params;
  const query = new Parse.Query(className);
  const count = await query.count({ useMasterKey: true });
  
  return {
    className: className,
    totalCount: count,
    timestamp: new Date().toISOString()
  };
});

// 14. دالة Cloud للتصدير
Parse.Cloud.define("exportData", async (request) => {
  const { className, limit = 1000 } = request.params;
  const query = new Parse.Query(className);
  query.limit(limit);
  
  const results = await query.find({ useMasterKey: true });
  const data = results.map(obj => obj.toJSON());
  
  return {
    className: className,
    count: data.length,
    data: data
  };
});

// 15. دالة Cloud للاستيراد
Parse.Cloud.define("importData", async (request) => {
  const { className, data } = request.params;
  
  if (!Array.isArray(data)) {
    throw new Parse.Error(Parse.Error.INVALID_JSON, "Data must be an array");
  }
  
  const results = [];
  for (const item of data) {
    const object = new Parse.Object(className);
    for (const key in item) {
      object.set(key, item[key]);
    }
    await object.save(null, { useMasterKey: true });
    results.push(object.id);
  }
  
  return {
    success: true,
    imported: results.length,
    ids: results
  };
});

// 16. دالة Cloud للتحقق من الصحة
Parse.Cloud.define("validate", (request) => {
  const { data } = request.params;
  
  if (!data || typeof data !== 'object') {
    throw new Parse.Error(Parse.Error.INVALID_JSON, "Invalid data format");
  }
  
  return { valid: true, message: "Data is valid" };
});

// 17. دالة Cloud للبحث النصي
Parse.Cloud.define("textSearch", async (request) => {
  const { className, searchTerm, field } = request.params;
  const query = new Parse.Query(className);
  
  // البحث النصي (يتطلب فهرس نصي في MongoDB)
  query.contains(field, searchTerm);
  
  const results = await query.find({ useMasterKey: true });
  return results;
});

// 18. دالة Cloud للترتيب
Parse.Cloud.define("getSorted", async (request) => {
  const { className, sortBy, order = "ascending" } = request.params;
  const query = new Parse.Query(className);
  
  if (order === "descending") {
    query.descending(sortBy);
  } else {
    query.ascending(sortBy);
  }
  
  const results = await query.find({ useMasterKey: true });
  return results;
});

// 19. دالة Cloud للتجميع
Parse.Cloud.define("aggregate", async (request) => {
  const { className } = request.params;
  const query = new Parse.Query(className);
  
  const results = await query.find({ useMasterKey: true });
  
  return {
    total: results.length,
    timestamp: new Date().toISOString(),
    className: className
  };
});

// 20. دالة Cloud للإشعارات
Parse.Cloud.define("sendNotification", async (request) => {
  const { title, message, target } = request.params;
  
  // يمكن إضافة منطق الإشعارات هنا
  console.log(`Notification: ${title} - ${message} to ${target}`);
  
  return {
    success: true,
    message: "Notification sent"
  };
});

console.log("✅ Cloud Code loaded successfully!");
