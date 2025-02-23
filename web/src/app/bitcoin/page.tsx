interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
  };
}

interface TwitterResponse {
  data: Tweet[];
}

async function getBitcoinTweets() {
  const searchTerms = ['bitcoin', 'crypto', 'btc'].join(',');
  const res = await fetch(`http://localhost:3000/api/tweets?terms=${searchTerms}`, {
    next: { revalidate: 60 }, // Revalidate every minute
  });
  if (!res.ok) {
    throw new Error('Failed to fetch tweets');
  }
  return res.json();
}

export default async function BitcoinPage() {
  const { data: tweets } = await getBitcoinTweets() as TwitterResponse;

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">#Bitcoin Tweets</h1>
      <div className="grid gap-4 max-w-2xl mx-auto">
        {tweets.map((tweet) => (
          <div key={tweet.id} className="p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-lg mb-3">{tweet.text}</p>
            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>
                {new Date(tweet.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              <span>♥ {tweet.public_metrics.like_count}</span>
              <span>🔁 {tweet.public_metrics.retweet_count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 