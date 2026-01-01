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

// =================== دوال اللعبة الرئيسية ===================

/**
 * جلب معلومات اللعبة الحالية
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('game_sc_information', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة بدون checkAuth
    const user = request.user;
    
    // إذا لم يكن هناك مستخدم، أرجع خطأ
    if (!user) {
      console.warn('⚠️ [Game1] game_sc_information: User not authenticated');
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }
    
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
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

/**
 * وضع رهان في اللعبة
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('game_bet', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة
    const user = request.user;
    
    if (!user) {
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }

    const { teamId, amount } = request.params;

    console.log(`💰 [Game1] game_bet: user=${user.id}, team=${teamId}, amount=${amount}`);

    // التحقق من المعاملات
    if (!teamId || !amount) {
      return {
        code: 400,
        message: 'Missing parameters: teamId and amount required',
        error: 'INVALID_PARAMS'
      };
    }

    // جلب بيانات المستخدم
    const userInfo = await getUserInfo(user);

    // التحقق من الرصيد
    if (userInfo.credits < amount) {
      return {
        code: 400,
        message: 'Insufficient balance',
        error: 'INSUFFICIENT_BALANCE'
      };
    }

    // خصم المبلغ
    user.set('credit', userInfo.credits - amount);
    user.set('totalBets', (userInfo.totalBets || 0) + 1);
    await user.save(null, { useMasterKey: true });

    // نتيجة عشوائية
    const result = getRandomSoccerResult();
    const won = result === teamId;
    
    let winnings = 0;
    if (won) {
      winnings = amount * SOCCER_ODDS[teamId];
      user.set('credit', userInfo.credits - amount + winnings);
      user.set('totalWins', (userInfo.totalWins || 0) + 1);
    } else {
      user.set('totalLosses', (userInfo.totalLosses || 0) + 1);
    }

    await user.save(null, { useMasterKey: true });

    console.log(`✅ [Game1] game_bet result: won=${won}, winnings=${winnings}`);

    return {
      code: 200,
      message: 'Bet placed successfully',
      data: {
        result: result,
        won: won,
        winnings: winnings,
        newBalance: userInfo.credits - amount + (won ? winnings : 0)
      }
    };
  } catch (e) {
    console.error('❌ [Game1] Error in game_bet:', e);
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

/**
 * جلب سجل الرهانات
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('game_sc_history', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة
    const user = request.user;
    
    if (!user) {
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }

    console.log(`📜 [Game1] game_sc_history requested by user: ${user.id}`);

    // محاكاة سجل الرهانات
    const history = [
      { gameId: 'game_1', team: 'team_a', amount: 100, result: 'won', winnings: 180 },
      { gameId: 'game_2', team: 'team_b', amount: 50, result: 'lost', winnings: 0 },
      { gameId: 'game_3', team: 'draw', amount: 200, result: 'won', winnings: 700 }
    ];

    return {
      code: 200,
      message: 'Success',
      data: history
    };
  } catch (e) {
    console.error('❌ [Game1] Error in game_sc_history:', e);
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

/**
 * جلب ترتيب اللاعبين
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('game_sc_ranking', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة
    const user = request.user;
    
    if (!user) {
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }

    console.log(`🏆 [Game1] game_sc_ranking requested by user: ${user.id}`);

    // محاكاة ترتيب اللاعبين
    const ranking = [
      { rank: 1, username: 'Player1', totalWins: 150, totalBets: 200 },
      { rank: 2, username: 'Player2', totalWins: 120, totalBets: 180 },
      { rank: 3, username: user.get('username'), totalWins: user.get('totalWins') || 0, totalBets: user.get('totalBets') || 0 }
    ];

    return {
      code: 200,
      message: 'Success',
      data: ranking
    };
  } catch (e) {
    console.error('❌ [Game1] Error in game_sc_ranking:', e);
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

/**
 * جلب ملف تعريف المستخدم
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('game_sc_profile', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة
    const user = request.user;
    
    if (!user) {
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }

    console.log(`👤 [Game1] game_sc_profile requested by user: ${user.id}`);

    const userInfo = await getUserInfo(user);

    return {
      code: 200,
      message: 'Success',
      data: userInfo
    };
  } catch (e) {
    console.error('❌ [Game1] Error in game_sc_profile:', e);
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

/**
 * تحديث الرصيد
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('updateBalance', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة
    const user = request.user;
    
    if (!user) {
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }

    const { amount, type } = request.params;

    console.log(`💵 [Game1] updateBalance: user=${user.id}, amount=${amount}, type=${type}`);

    const currentBalance = user.get('credit') || 0;
    let newBalance = currentBalance;

    if (type === 'add') {
      newBalance = currentBalance + amount;
    } else if (type === 'subtract') {
      newBalance = currentBalance - amount;
    } else {
      newBalance = amount;
    }

    user.set('credit', newBalance);
    await user.save(null, { useMasterKey: true });

    console.log(`✅ [Game1] Balance updated: ${currentBalance} -> ${newBalance}`);

    return {
      code: 200,
      message: 'Balance updated',
      data: {
        oldBalance: currentBalance,
        newBalance: newBalance
      }
    };
  } catch (e) {
    console.error('❌ [Game1] Error in updateBalance:', e);
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

/**
 * اختبار الاتصال
 */
Parse.Cloud.define('ping', async (request) => {
  return {
    code: 200,
    message: 'Pong!',
    timestamp: Date.now()
  };
});

// =================== دوال اللعبة الثانية (Fruit Wheel) ===================

/**
 * معلومات لعبة الفواكه
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('game_info', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة
    const user = request.user;
    
    if (!user) {
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }

    console.log(`🍎 [Game2] game_info requested by user: ${user.id}`);

    const userInfo = await getUserInfo(user);

    return {
      code: 200,
      message: 'Success',
      data: {
        userId: userInfo.objectId,
        username: userInfo.username,
        avatar: userInfo.avatar,
        balance: userInfo.credits,
        diamonds: userInfo.diamonds,
        totalWins: userInfo.totalWins,
        totalLosses: userInfo.totalLosses
      }
    };
  } catch (e) {
    console.error('❌ [Game2] Error in game_info:', e);
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

/**
 * اختيار الفاكهة (الرهان)
 * ✅ بدون استخدام checkAuth
 */
Parse.Cloud.define('game_choice', async (request) => {
  try {
    // ✅ استخدام request.user مباشرة
    const user = request.user;
    
    if (!user) {
      return { 
        code: 700, 
        message: "User not authenticated",
        error: "SESSION_MISSING"
      };
    }

    const { fruitId, amount } = request.params;

    console.log(`🎰 [Game2] game_choice: user=${user.id}, fruit=${fruitId}, amount=${amount}`);

    if (!fruitId || !amount) {
      return {
        code: 400,
        message: 'Missing parameters',
        error: 'INVALID_PARAMS'
      };
    }

    const userInfo = await getUserInfo(user);

    if (userInfo.credits < amount) {
      return {
        code: 400,
        message: 'Insufficient balance',
        error: 'INSUFFICIENT_BALANCE'
      };
    }

    // نتيجة عشوائية
    const fruits = ['apple', 'banana', 'cherry', 'diamond', 'grape'];
    const result = fruits[Math.floor(Math.random() * fruits.length)];
    const won = result === fruitId;
    
    let winnings = 0;
    if (won) {
      winnings = amount * 5;
      user.set('credit', userInfo.credits - amount + winnings);
      user.set('totalWins', (userInfo.totalWins || 0) + 1);
    } else {
      user.set('credit', userInfo.credits - amount);
      user.set('totalLosses', (userInfo.totalLosses || 0) + 1);
    }

    await user.save(null, { useMasterKey: true });

    return {
      code: 200,
      message: 'Choice processed',
      data: {
        result: result,
        won: won,
        winnings: winnings,
        newBalance: userInfo.credits - amount + (won ? winnings : 0)
      }
    };
  } catch (e) {
    console.error('❌ [Game2] Error in game_choice:', e);
    return {
      code: 500,
      message: 'Error: ' + e.message,
      error: e.code || 'UNKNOWN_ERROR'
    };
  }
});

console.log('✅ Cloud Functions loaded successfully');
