const OneSignal = require('@onesignal/node-onesignal');

/* ================== Helpers ================== */

async function getUserInfo(user) {
  await user.fetch({ useMasterKey: true });
  return {
    objectId: user.id,
    username: user.get('username'),
    avatar: user.get('avatar'),
    credits: user.get('credit') || 0,
    diamonds: user.get('diamonds') || 0,
    totalWins: user.get('totalWins') || 0,
    totalLosses: user.get('totalLosses') || 0,
    totalBets: user.get('totalBets') || 0,
  };
}

function getRandomSoccerResult() {
  const r = Math.random();
  if (r < 0.4) return 'team_a';
  if (r < 0.8) return 'team_b';
  return 'draw';
}

/* ================== Constants ================== */

const GAME_DURATION = 60;

const SOCCER_ODDS = {
  team_a: 1.8,
  team_b: 2.0,
  draw: 3.5,
};

/* ================== Game 1 ================== */

/**
 * Game Info
 */
Parse.Cloud.define(
  'game_sc_information',
  async (request) => {
    const user = request.user;
    const userInfo = await getUserInfo(user);

    const now = Math.floor(Date.now() / 1000);
    const round = Math.floor(now / GAME_DURATION);
    const roundEnd = (round + 1) * GAME_DURATION;

    return {
      code: 200,
      data: {
        userId: userInfo.objectId,
        username: userInfo.username,
        balance: userInfo.credits,
        gameId: `game_${round}`,
        countdown: Math.max(0, roundEnd - now),
        teams: [
          { teamId: 'team_a', odds: SOCCER_ODDS.team_a },
          { teamId: 'team_b', odds: SOCCER_ODDS.team_b },
          { teamId: 'draw', odds: SOCCER_ODDS.draw },
        ],
      },
    };
  },
  { requireUser: true }
);

/**
 * Place Bet
 */
Parse.Cloud.define(
  'game_bet',
  async (request) => {
    const user = request.user;
    const { teamId, amount } = request.params;

    if (!teamId || !amount) throw new Error('INVALID_PARAMS');

    const userInfo = await getUserInfo(user);
    if (userInfo.credits < amount) throw new Error('INSUFFICIENT_BALANCE');

    user.set('credit', userInfo.credits - amount);
    user.set('totalBets', userInfo.totalBets + 1);

    const result = getRandomSoccerResult();
    let winnings = 0;

    if (result === teamId) {
      winnings = amount * SOCCER_ODDS[teamId];
      user.set('credit', user.get('credit') + winnings);
      user.set('totalWins', userInfo.totalWins + 1);
    } else {
      user.set('totalLosses', userInfo.totalLosses + 1);
    }

    await user.save(null, { useMasterKey: true });

    return {
      code: 200,
      data: {
        result,
        winnings,
        balance: user.get('credit'),
      },
    };
  },
  { requireUser: true }
);

/**
 * Profile
 */
Parse.Cloud.define(
  'game_sc_profile',
  async (request) => {
    return {
      code: 200,
      data: await getUserInfo(request.user),
    };
  },
  { requireUser: true }
);

/**
 * History (Mock)
 */
Parse.Cloud.define(
  'game_sc_history',
  async () => {
    return {
      code: 200,
      data: [],
    };
  },
  { requireUser: true }
);

/**
 * Ranking (Mock)
 */
Parse.Cloud.define(
  'game_sc_ranking',
  async () => {
    return {
      code: 200,
      data: [],
    };
  },
  { requireUser: true }
);

/* ================== Utils ================== */

Parse.Cloud.define(
  'ping',
  async () => ({
    code: 200,
    message: 'pong',
    time: Date.now(),
  })
);

console.log('✅ Cloud Functions loaded cleanly');
