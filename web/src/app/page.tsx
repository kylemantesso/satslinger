import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-100">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="text-8xl mb-6">🤠</div>
          <h1 className="text-5xl font-bold text-amber-900 mb-4 font-serif">
            Howdy, Partner!
          </h1>
          <p className="text-xl text-amber-800 mb-8">
            Welcome to the wildest Bitcoin-tipping saloon on the digital frontier!
          </p>
          
          {/* Hackathon Badge */}
          <div className="inline-block bg-amber-100 border-2 border-amber-300 rounded-full px-4 py-2 text-amber-800">
            <a href="https://devpost.com/software/saslinger" target="_blank" rel="noopener noreferrer" className="hover:underline">
              🏆 Entry in NEAR Protocol's One Trillion Agents Hackathon
            </a>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-2xl p-8 border-2 border-amber-200">
          <div className="prose prose-lg max-w-none text-amber-800">
            <h2 className="text-3xl font-bold text-amber-900 mb-6">
              What in Tarnation is SatSlinger? 🌵
            </h2>
            
            <p className="mb-6">
              Like a trusty sheriff patrolling the digital plains, SatSlinger roams 
              X rewarding the finest posts with Bitcoin sats using 
              NEAR Protocol's Chain Signatures. We're bringing Wild West justice to 
              social media, one tip at a time!
            </p>

            <div className="border-b-2 border-dashed border-amber-200 my-8"></div>

            <h3 className="text-2xl font-bold text-amber-900 mb-4">
              How It Works 🎯
            </h3>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <div className="bg-amber-50 p-6 rounded-lg">
                <div className="text-4xl mb-2">🔍</div>
                <h4 className="font-bold mb-2">Scout</h4>
                <p className="text-sm">
                  We scout the territory for the most engaging posts on X
                </p>
              </div>
              
              <div className="bg-amber-50 p-6 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <h4 className="font-bold mb-2">Reward</h4>
                <p className="text-sm">
                  Top posts get rewarded with Bitcoin sats
                </p>
              </div>
              
              <div className="bg-amber-50 p-6 rounded-lg">
                <div className="text-4xl mb-2">🎉</div>
                <h4 className="font-bold mb-2">Claim</h4>
                <p className="text-sm">
                  Creators claim their rewards faster than a quick-draw!
                </p>
              </div>
            </div>

            <div className="border-b-2 border-dashed border-amber-200 my-8"></div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-amber-900 mb-4">
                Ready to Join the Posse? 🌟
              </h3>
              
              <div className="flex gap-4 justify-center mt-8">
                <a
                  href="https://x.com/SatSlinger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <span className="mr-2">𝕏</span>
                  Follow @SatSlinger
                </a>
                
                <a
                  href="https://devpost.com/software/saslinger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  🚀 View on Devpost
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-amber-700">
          <p>
            Built for the NEAR Protocol One Trillion Agents Hackathon
            <span className="mx-2">•</span>
            Powered by NEAR Protocol & Bitcoin 
            <span className="mx-2">•</span>
            Bringing Web3 to the Wild West 🤠
          </p>
        </footer>
      </div>
    </div>
  );
}
