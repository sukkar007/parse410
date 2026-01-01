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
/**
 * Parse Cloud Functions - Soccer/Dice Game
 * ==========================================
 * Backend متكامل للعبة الأولى (Soccer/Dice)
 * بنفس طريقة عمل اللعبة الثانية (Fruit Wheel)
 */

// =================== الثوابت والإعدادات ===================

const GAME_TYPES = {
  SOCCER: 'soccer',
  DICE: 'dice'
};

const SOCCER_ODDS = {
  team_a: 1.8,
  team_b: 2.0,
  draw: 3.5
};

const DICE_ODDS = {
  1: 5.0,
  2: 5.0,
  3: 5.0,
  4: 5.0,
  5: 5.0,
  6: 5.0
};

const GAME_DURATION = 60; // ثانية

// =================== دوال المساعدة ===================

/**
 * التحقق من المصادقة
 */
function checkAuth(request) {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.SESSION_MISSING, 'User not authenticated');
  }
  return user;
}

/**
 * الحصول على معلومات المستخدم
 */
async function getUserInfo(user) {
  try {
    await user.fetch({ useMasterKey: true });
    return {
      objectId: user.id,
      username: user.get('username'),
      email: user.get('email'),
      avatar: user.get('avatar'),
      credits: user.get('credit') || 0,
      diamonds: user.get('diamonds') || 0,
      totalWins: user.get('totalWins') || 0,
      totalLosses: user.get('totalLosses') || 0,
      totalBets: user.get('totalBets') || 0,
    };
  } catch (e) {
    console.error('❌ Error getting user info:', e);
    throw e;
  }
}

/**
 * حساب رقم عشوائي للنرد
 */
function getRandomDiceResult() {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * حساب نتيجة مباراة كرة قدم عشوائية
 */
function getRandomSoccerResult() {
  const rand = Math.random();
  if (rand < 0.4) return 'team_a';
  if (rand < 0.8) return 'team_b';
  return 'draw';
}

// =================== دوال اللعبة الرئيسية ===================

/**
 * جلب معلومات اللعبة الحالية
 */
Parse.Cloud.define('game_sc_information', async (request) => {
  try {
    const user = checkAuth(request);
    
    console.log(`🎮 [Game1] game_sc_information requested by user: ${user.id}`);

    // جلب بيانات المستخدم
    const userInfo = await getUserInfo(user);

    // حساب الجولة الحالية
    const currentTime = Math.floor(Date.now() / 1000);
    const currentRound = Math.floor(currentTime / GAME_DURATION);
    const roundStartTime = currentRound * GAME_DURATION;
    const roundEndTime = roundStartTime + GAME_DURATION;
    const countdown = Math.max(0, roundEndTime - currentTime);

    // محاكاة معلومات اللعبة
    const gameInfo = {
      code: 200,
      message: 'Success',
      data: {
        userId: userInfo.objectId,
        username: userInfo.username,
        avatar: userInfo.avatar,
        balance: userInfo.credits,
        totalWins: userInfo.totalWins,
        totalLosses: userInfo.totalLosses,
        
        // معلومات اللعبة الحالية
        gameId: `game_${currentRound}`,
        gameType: GAME_TYPES.SOCCER,
        status: countdown > 5 ? 'betting' : 'closing',
        countdown: countdown,
        
        // فريق كرة القدم
        teams: [
          {
            teamId: 'team_a',
            teamName: 'Team A',
            odds: SOCCER_ODDS.team_a,
            totalBets: Math.floor(Math.random() * 5000) + 1000
          },
          {
            teamId: 'team_b',
            teamName: 'Team B',
            odds: SOCCER_ODDS.team_b,
            totalBets: Math.floor(Math.random() * 5000) + 1000
          },
          {
            teamId: 'draw',
            teamName: 'Draw',
            odds: SOCCER_ODDS.draw,
            totalBets: Math.floor(Math.random() * 2000) + 500
          }
        ],
        
        // آخر 5 نتائج
        resultHistory: ['team_a', 'team_b', 'draw', 'team_a', 'team_b'],
        
        // رهانات المستخدم الحالية
        myBets: {
          team_a: 0,
          team_b: 0,
          draw: 0
        }
      }
    };

    console.log('✅ [Game1] game_sc_information response sent');
    return gameInfo;
  } catch (e) {
    console.error('❌ [Game1] Error in game_sc_information:', e);
    throw new Parse.Error(Parse.Error.SCRIPT_FAILED, 'Game info error: ' + e.message);
  }
});

/**
 * وضع رهان في اللعبة
 */
Parse.Cloud.define('game_bet', async (request) => {
  try {
    const user = checkAuth(request);
    const { gameId, choice, amount } = request.params;

    console.log(`💰 [Game1] game_bet: user=${user.id}, choice=${choice}, amount=${amount}`);

    // التحقق من المعاملات
    if (!gameId || !choice || !amount || amount <= 0) {
      throw new Parse.Error(400, 'Invalid parameters');
    }

    // جلب بيانات المستخدم
    await user.fetch({ useMasterKey: true });
    const currentCredits = user.get('credit') || 0;

    // التحقق من الرصيد
    if (currentCredits < amount) {
      console.error(`❌ [Game1] Insufficient credits: ${currentCredits} < ${amount}`);
      throw new Parse.Error(400, 'Insufficient balance');
    }

    // خصم الرصيد
    user.increment('credit', -amount);
    user.increment('totalBets', amount);
    await user.save(null, { useMasterKey: true });

    // محاكاة نتيجة اللعبة
    const gameResult = choice.includes('dice') ? getRandomDiceResult() : getRandomSoccerResult();
    const isWin = gameResult === choice;
    
    // حساب الربح
    const odds = SOCCER_ODDS[choice] || DICE_ODDS[choice] || 1.5;
    const winAmount = isWin ? Math.floor(amount * odds) : 0;
    const newBalance = currentCredits - amount + winAmount;

    // تحديث إحصائيات المستخدم
    user.set('credit', newBalance);
    if (isWin) {
      user.increment('totalWins', 1);
    } else {
      user.increment('totalLosses', 1);
    }
    await user.save(null, { useMasterKey: true });

    // تسجيل الرهان
    const BetLog = Parse.Object.extend('BetLog');
    const betLog = new BetLog();
    betLog.set('user', user);
    betLog.set('gameId', gameId);
    betLog.set('choice', choice);
    betLog.set('amount', amount);
    betLog.set('result', gameResult);
    betLog.set('isWin', isWin);
    betLog.set('winAmount', winAmount);
    betLog.set('newBalance', newBalance);
    await betLog.save(null, { useMasterKey: true });

    const response = {
      code: 200,
      message: 'Bet placed successfully',
      data: {
        betId: betLog.id,
        result: gameResult,
        isWin: isWin,
        winAmount: winAmount,
        newBalance: newBalance,
        message: isWin ? 'You won!' : 'You lost!'
      }
    };

    console.log('✅ [Game1] game_bet response:', response);
    return response;
  } catch (e) {
    console.error('❌ [Game1] Error in game_bet:', e);
    throw new Parse.Error(Parse.Error.SCRIPT_FAILED, 'Bet error: ' + e.message);
  }
});

/**
 * جلب سجل الرهانات
 */
Parse.Cloud.define('game_sc_history', async (request) => {
  try {
    const user = checkAuth(request);

    console.log(`📋 [Game1] game_sc_history requested by user: ${user.id}`);

    // جلب سجل الرهانات
    const BetLog = Parse.Object.extend('BetLog');
    const query = new Parse.Query(BetLog);
    query.equalTo('user', user);
    query.descending('createdAt');
    query.limit(20);
    const bets = await query.find({ useMasterKey: true });

    const betHistory = bets.map(bet => ({
      betId: bet.id,
      gameId: bet.get('gameId'),
      choice: bet.get('choice'),
      amount: bet.get('amount'),
      result: bet.get('result'),
      isWin: bet.get('isWin'),
      winAmount: bet.get('winAmount'),
      date: bet.createdAt.getTime(),
    }));

    const response = {
      code: 200,
      message: 'Success',
      data: {
        bets: betHistory
      }
    };

    console.log('✅ [Game1] game_sc_history response sent');
    return response;
  } catch (e) {
    console.error('❌ [Game1] Error in game_sc_history:', e);
    throw new Parse.Error(Parse.Error.SCRIPT_FAILED, 'History error: ' + e.message);
  }
});

/**
 * جلب ترتيب اللاعبين
 */
Parse.Cloud.define('game_sc_ranking', async (request) => {
  try {
    const user = checkAuth(request);

    console.log(`🏆 [Game1] game_sc_ranking requested by user: ${user.id}`);

    // جلب أفضل اللاعبين
    const topPlayersQuery = new Parse.Query(Parse.User);
    topPlayersQuery.descending('totalWins');
    topPlayersQuery.limit(10);
    const topPlayers = await topPlayersQuery.find({ useMasterKey: true });

    const ranking = topPlayers.map((player, index) => ({
      rank: index + 1,
      username: player.get('username'),
      avatar: player.get('avatar'),
      totalWins: player.get('totalWins') || 0,
      totalLosses: player.get('totalLosses') || 0,
      balance: player.get('credit') || 0,
      winRate: player.get('totalWins') ? 
        ((player.get('totalWins') / (player.get('totalWins') + player.get('totalLosses'))) * 100).toFixed(2) : 0
    }));

    const response = {
      code: 200,
      message: 'Success',
      data: {
        ranking: ranking
      }
    };

    console.log('✅ [Game1] game_sc_ranking response sent');
    return response;
  } catch (e) {
    console.error('❌ [Game1] Error in game_sc_ranking:', e);
    throw new Parse.Error(Parse.Error.SCRIPT_FAILED, 'Ranking error: ' + e.message);
  }
});

/**
 * جلب ملف تعريف المستخدم
 */
Parse.Cloud.define('game_sc_profile', async (request) => {
  try {
    const user = checkAuth(request);

    console.log(`👤 [Game1] game_sc_profile requested by user: ${user.id}`);

    const userInfo = await getUserInfo(user);

    const response = {
      code: 200,
      message: 'Success',
      data: userInfo
    };

    console.log('✅ [Game1] game_sc_profile response sent');
    return response;
  } catch (e) {
    console.error('❌ [Game1] Error in game_sc_profile:', e);
    throw new Parse.Error(Parse.Error.SCRIPT_FAILED, 'Profile error: ' + e.message);
  }
});

/**
 * تحديث الرصيد
 */
Parse.Cloud.define('updateBalance', async (request) => {
  try {
    const user = checkAuth(request);
    const { amount } = request.params;

    if (amount === undefined || amount === null) {
      throw new Parse.Error(400, 'amount is required');
    }

    console.log(`💵 [Game1] updateBalance: user=${user.id}, amount=${amount}`);

    // جلب بيانات المستخدم
    await user.fetch({ useMasterKey: true });

    // تحديث الرصيد
    const currentCredits = user.get('credit') || 0;
    const newBalance = currentCredits + amount;

    user.set('credit', newBalance);
    await user.save(null, { useMasterKey: true });

    const response = {
      code: 200,
      message: 'Balance updated successfully',
      data: {
        newBalance: newBalance
      }
    };

    console.log('✅ [Game1] updateBalance response sent');
    return response;
  } catch (e) {
    console.error('❌ [Game1] Error in updateBalance:', e);
    throw new Parse.Error(Parse.Error.SCRIPT_FAILED, 'Update balance error: ' + e.message);
  }
});

/**
 * اختبار الاتصال
 */
Parse.Cloud.define('ping', async (request) => {
  console.log('🏓 [Game1] Ping received');
  return {
    code: 200,
    message: 'Pong!',
    timestamp: new Date().getTime()
  };
});

console.log('✅ [Game1] All game functions loaded successfully');

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
/**
 * Parse Cloud Code for Fruit Wheel Game
 * مخصص للعبة عجلة الفواكه بناءً على تحليل البروتوكولات
 */

const FruitWheelRound = Parse.Object.extend("FruitWheelRound");
const FruitWheelBet = Parse.Object.extend("FruitWheelBet");

// إعدادات اللعبة
const STAGES = {
    NONE: 0,
    BET: 1,
    PREPARE: 2,
    FINISH: 3
};

const TIMES = {
    BET: 30,      // وقت الرهان
    PREPARE: 5,   // وقت التحضير/الدوران
    FINISH: 10,   // وقت عرض النتيجة
    NONE: 2       // وقت الراحة
};

const FRUIT_RATES = [5, 5, 5, 5, 10, 15, 25, 45]; // مضاعفات الفواكه (0-7)

/**
 * جلب معلومات اللعبة الحالية
 */
Parse.Cloud.define("fruit_game_info", async (request) => {
    const user = request.user;
    if (!user) throw new Parse.Error(Parse.Error.SESSION_MISSING, "User not authenticated");

    const now = Math.floor(Date.now() / 1000);
    
    // جلب الجولة الحالية أو إنشاء واحدة جديدة
    let currentRound = await new Parse.Query(FruitWheelRound)
        .descending("createdAt")
        .first({ useMasterKey: true });

    if (!currentRound || currentRound.get("endTime") < now) {
        currentRound = await createNewRound();
    }

    const stage = currentRound.get("stage");
    const endTime = currentRound.get("endTime");
    const leftSeconds = Math.max(0, endTime - now);

    // جلب رصيد المستخدم
    await user.fetch({ useMasterKey: true });
    const userCoin = user.get("credit") || 0;

    // جلب سجل النتائج (آخر 20 نتيجة)
    const historyQuery = new Parse.Query(FruitWheelRound);
    historyQuery.equalTo("stage", STAGES.FINISH);
    historyQuery.descending("createdAt");
    historyQuery.limit(20);
    const historyRounds = await historyQuery.find({ useMasterKey: true });
    const history = historyRounds.map(r => r.get("resultId") || 0);

    // جلب رهانات المستخدم في هذه الجولة
    const userBetsQuery = new Parse.Query(FruitWheelBet);
    userBetsQuery.equalTo("user", user);
    userBetsQuery.equalTo("roundId", currentRound.id);
    const userBets = await userBetsQuery.find({ useMasterKey: true });
    
    const myselfBet = [0, 0, 0, 0, 0, 0, 0, 0];
    userBets.forEach(bet => {
        myselfBet[bet.get("fruitId")] += bet.get("amount");
    });

    // جلب إجمالي الرهانات (للمحاكاة أو من البيانات الحقيقية)
    const totalBet = currentRound.get("totalBets") || [0, 0, 0, 0, 0, 0, 0, 0];

    return {
        code: 0,
        data: {
            stage: stage,
            roundId: currentRound.id,
            leftSeconds: leftSeconds,
            userCoin: userCoin,
            history: history,
            myselfBet: myselfBet,
            totalBet: totalBet
        }
    };
});

/**
 * وضع رهان
 */
Parse.Cloud.define("fruit_game_bet", async (request) => {
    const user = request.user;
    if (!user) throw new Parse.Error(Parse.Error.SESSION_MISSING, "User not authenticated");

    const { fruitId, amount } = request.params;
    if (fruitId < 0 || fruitId > 7 || amount <= 0) {
        throw new Parse.Error(400, "Invalid bet parameters");
    }

    // جلب الجولة الحالية
    const currentRound = await new Parse.Query(FruitWheelRound)
        .descending("createdAt")
        .first({ useMasterKey: true });

    if (!currentRound || currentRound.get("stage") !== STAGES.BET) {
        throw new Parse.Error(400, "Betting is not allowed at this stage");
    }

    // التحقق من الرصيد
    await user.fetch({ useMasterKey: true });
    const balance = user.get("credit") || 0;
    if (balance < amount) {
        throw new Parse.Error(10062, "Insufficient balance");
    }

    // خصم الرصيد
    user.increment("credit", -amount);
    await user.save(null, { useMasterKey: true });

    // تسجيل الرهان
    const bet = new FruitWheelBet();
    bet.set("user", user);
    bet.set("roundId", currentRound.id);
    bet.set("fruitId", fruitId);
    bet.set("amount", amount);
    await bet.save(null, { useMasterKey: true });

    // تحديث إجمالي الرهانات في الجولة
    const totalBets = currentRound.get("totalBets") || [0, 0, 0, 0, 0, 0, 0, 0];
    totalBets[fruitId] += amount;
    currentRound.set("totalBets", totalBets);
    await currentRound.save(null, { useMasterKey: true });

    return {
        code: 0,
        roundId: currentRound.id,
        fruitId: fruitId,
        amount: amount,
        newBalance: user.get("credit")
    };
});

/**
 * وظيفة داخلية لإنشاء جولة جديدة
 */
async function createNewRound() {
    const now = Math.floor(Date.now() / 1000);
    const round = new FruitWheelRound();
    round.set("stage", STAGES.BET);
    round.set("startTime", now);
    round.set("endTime", now + TIMES.BET);
    round.set("totalBets", [0, 0, 0, 0, 0, 0, 0, 0]);
    return await round.save(null, { useMasterKey: true });
}

/**
 * وظيفة خلفية (Job) لتحديث مراحل اللعبة وتوزيع الأرباح
 * يجب تشغيلها كل ثانية أو استخدام نظام Cron
 */
Parse.Cloud.define("fruit_game_tick", async (request) => {
    const now = Math.floor(Date.now() / 1000);
    
    let currentRound = await new Parse.Query(FruitWheelRound)
        .descending("createdAt")
        .first({ useMasterKey: true });

    if (!currentRound) {
        await createNewRound();
        return "New round created";
    }

    const stage = currentRound.get("stage");
    const endTime = currentRound.get("endTime");

    if (now >= endTime) {
        if (stage === STAGES.BET) {
            // الانتقال لمرحلة التحضير
            currentRound.set("stage", STAGES.PREPARE);
            currentRound.set("endTime", now + TIMES.PREPARE);
        } 
        else if (stage === STAGES.PREPARE) {
            // الانتقال لمرحلة النتيجة وتوزيع الأرباح
            const resultId = Math.floor(Math.random() * 8);
            currentRound.set("stage", STAGES.FINISH);
            currentRound.set("resultId", resultId);
            currentRound.set("endTime", now + TIMES.FINISH);
            
            // توزيع الأرباح
            await distributeWinnings(currentRound.id, resultId);
        }
        else if (stage === STAGES.FINISH) {
            // الانتقال لمرحلة الراحة
            currentRound.set("stage", STAGES.NONE);
            currentRound.set("endTime", now + TIMES.NONE);
        }
        else {
            // إنشاء جولة جديدة
            await createNewRound();
            return "New round started";
        }
        await currentRound.save(null, { useMasterKey: true });
    }
    
    return "Tick processed";
});

async function distributeWinnings(roundId, resultId) {
    const betsQuery = new Parse.Query(FruitWheelBet);
    betsQuery.equalTo("roundId", roundId);
    betsQuery.equalTo("fruitId", resultId);
    const winningBets = await betsQuery.find({ useMasterKey: true });

    const rate = FRUIT_RATES[resultId];

    for (const bet of winningBets) {
        const user = bet.get("user");
        const winAmount = bet.get("amount") * rate;
        
        // إضافة الأرباح للمستخدم
        const userObj = await new Parse.Query(Parse.User).get(user.id, { useMasterKey: true });
        userObj.increment("credit", winAmount);
        await userObj.save(null, { useMasterKey: true });
        
        // تحديث الرهان كفائز
        bet.set("winAmount", winAmount);
        await bet.save(null, { useMasterKey: true });
    }
}

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
