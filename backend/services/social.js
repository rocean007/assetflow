const axios = require('axios');
const RSSParser = require('rss-parser');

const rss = new RSSParser({ timeout: 8000 });

/**
 * Manipulation heuristics — signals that a post/thread may be coordinated or astroturfed.
 * Returns a score 0-100. Higher = more suspicious.
 */
function manipulationScore(post) {
  let score = 0;
  const text = `${post.title} ${post.body || ''}`.toLowerCase();

  // Price target without reasoning
  if (/\$\d{2,6}(\s|$)/.test(text) && !/(because|due to|earnings|revenue|analysis)/.test(text)) score += 20;

  // Rocket emojis / TO THE MOON language
  if (/(🚀|🌙|moon|lambo|apes|hodl|diamond hands|tendies)/.test(text)) score += 15;

  // All caps urgency
  if ((text.match(/[A-Z]{4,}/g) || []).length > 3) score += 10;

  // "Not financial advice" with strong directional claim
  if (/not financial advice/.test(text) && /(buy|sell|short|long|calls|puts)/.test(text)) score += 10;

  // Very new account (if available)
  if (post.accountAgeDays != null && post.accountAgeDays < 30) score += 25;

  // Extremely high engagement on brand new post (possible coordinated upvote)
  if (post.score > 5000 && post.ageMinutes != null && post.ageMinutes < 60) score += 20;

  // Repeating the ticker many times
  const tickerMentions = (text.match(/\b[A-Z]{2,5}\b/g) || []).length;
  if (tickerMentions > 8) score += 10;

  return Math.min(100, score);
}

/**
 * Reddit — public JSON API, no key needed
 * Searches r/stocks, r/investing, r/wallstreetbets, r/options, r/SecurityAnalysis
 */
async function fetchReddit(symbol, maxPosts = 20) {
  const subreddits = ['stocks', 'investing', 'wallstreetbets', 'SecurityAnalysis', 'StockMarket'];
  const results = [];

  await Promise.allSettled(subreddits.map(async (sub) => {
    try {
      const res = await axios.get(
        `https://www.reddit.com/r/${sub}/search.json`,
        {
          params: { q: symbol, sort: 'new', limit: 8, t: 'day', restrict_sr: 1 },
          headers: { 'User-Agent': 'AssetFlow/1.0 (analysis bot)' },
          timeout: 8000,
        }
      );
      const posts = res.data?.data?.children || [];
      posts.forEach(({ data: p }) => {
        const ageMinutes = (Date.now() / 1000 - p.created_utc) / 60;
        const post = {
          platform: 'reddit',
          subreddit: `r/${sub}`,
          title: p.title || '',
          body: (p.selftext || '').slice(0, 400),
          url: `https://reddit.com${p.permalink}`,
          score: p.score || 0,
          comments: p.num_comments || 0,
          upvoteRatio: p.upvote_ratio || 0.5,
          published: new Date(p.created_utc * 1000).toISOString(),
          ageMinutes,
          sentiment: null, // filled later
        };
        post.manipulationScore = manipulationScore(post);
        results.push(post);
      });
    } catch (_) {}
  }));

  return results
    .sort((a, b) => new Date(b.published) - new Date(a.published))
    .slice(0, maxPosts);
}

/**
 * X (Twitter) — via Nitter public RSS instances (no API key)
 * Nitter is a Twitter frontend with RSS feeds
 */
async function fetchXPosts(symbol, maxPosts = 15) {
  // Multiple Nitter instances for resilience
  const nitterInstances = [
    'https://nitter.poast.org',
    'https://nitter.privacydev.net',
    'https://nitter.1d4.us',
  ];

  const queries = [`${symbol} stock`, `$${symbol}`, `${symbol} earnings`];
  const results = [];

  for (const instance of nitterInstances) {
    if (results.length >= maxPosts) break;
    for (const q of queries) {
      try {
        const feedUrl = `${instance}/search/rss?q=${encodeURIComponent(q)}&f=tweets`;
        const parsed = await rss.parseURL(feedUrl);
        (parsed.items || []).slice(0, 5).forEach(item => {
          const post = {
            platform: 'x',
            subreddit: 'Twitter/X',
            title: item.title || '',
            body: (item.contentSnippet || '').slice(0, 300),
            url: item.link || '',
            score: 0,
            comments: 0,
            upvoteRatio: 0.5,
            published: item.pubDate || item.isoDate || new Date().toISOString(),
            ageMinutes: null,
          };
          post.manipulationScore = manipulationScore(post);
          results.push(post);
        });
        break; // success on this instance, move to next query
      } catch (_) {}
    }
  }

  return results.slice(0, maxPosts);
}

/**
 * StockTwits — public API, no key needed
 */
async function fetchStockTwits(symbol, maxPosts = 15) {
  try {
    const res = await axios.get(
      `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`,
      { timeout: 8000 }
    );
    const messages = res.data?.messages || [];
    return messages.slice(0, maxPosts).map(m => {
      const post = {
        platform: 'stocktwits',
        subreddit: 'StockTwits',
        title: m.body?.slice(0, 200) || '',
        body: '',
        url: `https://stocktwits.com/message/${m.id}`,
        score: m.likes?.total || 0,
        comments: m.replies_count || 0,
        upvoteRatio: 0.5,
        published: m.created_at || new Date().toISOString(),
        ageMinutes: null,
        // StockTwits provides native sentiment
        nativeSentiment: m.entities?.sentiment?.basic || null,
        accountAgeDays: null,
      };
      post.manipulationScore = manipulationScore(post);
      return post;
    });
  } catch (_) { return []; }
}

/**
 * HackerNews — for tech/AI company analysis
 */
async function fetchHackerNews(symbol, maxPosts = 8) {
  try {
    const res = await axios.get(
      `https://hn.algolia.com/api/v1/search_by_date`,
      {
        params: { query: symbol, tags: '(story,comment)', hitsPerPage: 8, numericFilters: 'created_at_i>0' },
        timeout: 8000,
      }
    );
    return (res.data?.hits || []).map(h => ({
      platform: 'hackernews',
      subreddit: 'HackerNews',
      title: h.title || h.comment_text?.slice(0, 100) || '',
      body: (h.story_text || '').slice(0, 300),
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points || 0,
      comments: h.num_comments || 0,
      upvoteRatio: 0.8,
      published: h.created_at || new Date().toISOString(),
      ageMinutes: null,
      manipulationScore: 5, // HN has strong moderation
    }));
  } catch (_) { return []; }
}

/**
 * Aggregate all social sources with manipulation filtering
 */
async function fetchAllSocial(symbol) {
  const [reddit, xPosts, stocktwits, hn] = await Promise.allSettled([
    fetchReddit(symbol),
    fetchXPosts(symbol),
    fetchStockTwits(symbol),
    fetchHackerNews(symbol),
  ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : []));

  const all = [...reddit, ...xPosts, ...stocktwits, ...hn];

  // Separate clean from suspicious
  const clean = all.filter(p => p.manipulationScore < 40);
  const suspicious = all.filter(p => p.manipulationScore >= 40);

  // Aggregate sentiment from StockTwits native signals
  const stSentiments = stocktwits.filter(p => p.nativeSentiment);
  const bullishST = stSentiments.filter(p => p.nativeSentiment === 'Bullish').length;
  const bearishST = stSentiments.filter(p => p.nativeSentiment === 'Bearish').length;

  // Reddit score-weighted sentiment proxy (WSB posts with high score + rocket = bullish signal, BUT also high manip score)
  const redditHighScore = reddit.filter(p => p.score > 100 && p.manipulationScore < 40);

  return {
    all,
    clean,
    suspicious,
    stats: {
      total: all.length,
      clean: clean.length,
      suspicious: suspicious.length,
      byPlatform: {
        reddit: reddit.length,
        x: xPosts.length,
        stocktwits: stocktwits.length,
        hackernews: hn.length,
      },
      stocktwitsSentiment: stSentiments.length
        ? { bullish: bullishST, bearish: bearishST, total: stSentiments.length }
        : null,
      redditHighScorePosts: redditHighScore.length,
    },
    // Formatted for LLM context
    summary: buildSocialSummary(clean, suspicious, symbol),
  };
}

function buildSocialSummary(clean, suspicious, symbol) {
  const cleanText = clean.slice(0, 20).map(p =>
    `[${p.platform}/${p.subreddit}] ${p.title}${p.body ? ' — ' + p.body.slice(0, 120) : ''} (score:${p.score}, manip:${p.manipulationScore}%)`
  ).join('\n');

  const suspText = suspicious.slice(0, 6).map(p =>
    `[SUSPICIOUS:${p.manipulationScore}%] [${p.platform}] ${p.title.slice(0, 100)}`
  ).join('\n');

  return `SOCIAL MEDIA SIGNALS FOR ${symbol}:

CREDIBLE POSTS (manipulation score <40%):
${cleanText || 'No credible social posts found'}

SUSPICIOUS/LIKELY MANIPULATED POSTS (shown for awareness, should be heavily discounted):
${suspText || 'None flagged'}`;
}

module.exports = { fetchAllSocial, fetchReddit, fetchXPosts, fetchStockTwits, fetchHackerNews, manipulationScore };
