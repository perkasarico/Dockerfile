const fs = require('fs');
const https = require('https');

class SandchainQuestClaimer {
    constructor() {
        this.baseUrl = 'https://api.sandchain.com/api/v1/quests';
        this.tokens = [];
        this.questIds = {
            twitter: '324f6380-6b3f-4ad6-a198-d1061881da09',
            discord: '790cc337-ac59-4712-a31e-5355627e259b'
        };
        
        this.requestCount = 3000; // 3000 request per task
        
        this.stats = {
            totalCycles: 0,
            totalRequests: 0,
            totalSuccess: 0,
            totalFailed: 0
        };
    }

    loadTokens() {
        try {
            const data = fs.readFileSync('token.txt', 'utf8');
            this.tokens = data.trim().split('\n').filter(token => token.trim() !== '');
            if (this.tokens.length === 0) {
                console.error('❌ No tokens found in token.txt');
                return false;
            }
            
            console.log(`✅ Loaded ${this.tokens.length} tokens`);
            return true;
        } catch (error) {
            console.error('❌ Error loading tokens:', error.message);
            return false;
        }
    }

    makeRequest(token, questId, requestIndex) {
        return new Promise((resolve, reject) => {
            const url = `${this.baseUrl}/${questId}/claim-reward`;
            const urlObj = new URL(url);
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'accept': '*/*',
                    'accept-encoding': 'gzip, deflate, br, zstd',
                    'accept-language': 'en-US,en;q=0.5',
                    'authorization': `Bearer ${token}`,
                    'content-length': '0',
                    'content-type': 'application/json',
                    'origin': 'https://app.sandchain.com',
                    'referer': 'https://app.sandchain.com/',
                    'sec-ch-ua': '"Brave";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    'sec-gpc': '1',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        resolve({
                            success: res.statusCode === 201,
                            statusCode: res.statusCode,
                            data: response,
                            requestIndex: requestIndex
                        });
                    } catch (error) {
                        resolve({
                            success: false,
                            statusCode: res.statusCode,
                            requestIndex: requestIndex
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject({ success: false, requestIndex: requestIndex });
            });

            req.setTimeout(30000, () => {
                req.destroy();
                reject({ success: false, requestIndex: requestIndex });
            });

            req.end();
        });
    }

    async processQuestForToken(token, questType, tokenIndex) {
        const questId = this.questIds[questType];
        if (!questId) return { success: 0, failed: 0 };

        console.log(`🚀 Token ${tokenIndex + 1} - ${questType.toUpperCase()}: Sending ${this.requestCount} requests...`);
        
        const startTime = Date.now();
        
        // Create 3000 identical requests with same token
        const promises = [];
        for (let i = 0; i < this.requestCount; i++) {
            promises.push(
                this.makeRequest(token, questId, i + 1).catch(error => ({ 
                    success: false, 
                    requestIndex: i + 1 
                }))
            );
        }

        try {
            // Execute ALL 3000 requests simultaneously
            const results = await Promise.all(promises);
            
            let successCount = 0;
            let failedCount = 0;
            
            results.forEach((result) => {
                if (result.success) {
                    successCount++;
                } else {
                    failedCount++;
                }
            });
            
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            console.log(`✅ Token ${tokenIndex + 1} - ${questType.toUpperCase()}: ${successCount}/${this.requestCount} berhasil (${duration}s)`);
            
            return { success: successCount, failed: failedCount };
            
        } catch (error) {
            console.log(`❌ Token ${tokenIndex + 1} - ${questType.toUpperCase()}: Error occurred`);
            return { success: 0, failed: this.requestCount };
        }
    }

    async processCycle() {
        this.stats.totalCycles++;
        console.log(`\n🔄 ========== CYCLE ${this.stats.totalCycles} ==========`);
        console.log(`📅 ${new Date().toLocaleString()}`);
        
        const cycleStartTime = Date.now();
        let cycleSuccess = 0;
        let cycleFailed = 0;

        // Process all tokens
        for (let i = 0; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            
            console.log(`\n👤 Processing Token ${i + 1}/${this.tokens.length}: ${token.substring(0, 20)}...`);
            
            // Process Twitter quest
            const twitterResult = await this.processQuestForToken(token, 'twitter', i);
            cycleSuccess += twitterResult.success;
            cycleFailed += twitterResult.failed;
            
            // Process Discord quest
            const discordResult = await this.processQuestForToken(token, 'discord', i);
            cycleSuccess += discordResult.success;
            cycleFailed += discordResult.failed;
        }

        const cycleEndTime = Date.now();
        const cycleDuration = ((cycleEndTime - cycleStartTime) / 1000).toFixed(2);
        
        // Update total stats
        this.stats.totalRequests += (cycleSuccess + cycleFailed);
        this.stats.totalSuccess += cycleSuccess;
        this.stats.totalFailed += cycleFailed;
        
        console.log(`\n📊 CYCLE ${this.stats.totalCycles} COMPLETED:`);
        console.log(`⏱️  Duration: ${cycleDuration}s`);
        console.log(`✅ Success: ${cycleSuccess}`);
        console.log(`❌ Failed: ${cycleFailed}`);
        console.log(`📈 Cycle Success Rate: ${((cycleSuccess / (cycleSuccess + cycleFailed)) * 100).toFixed(2)}%`);
    }

    async run() {
        console.log('🚀 Sandchain Quest INFINITE LOOP Claimer');
        console.log('=========================================');
        
        if (!this.loadTokens()) {
            console.error('❌ Failed to load tokens');
            return;
        }

        console.log(`🎯 ${this.requestCount} requests per task per token`);
        console.log(`🔄 Will loop infinitely through ${this.tokens.length} tokens`);
        console.log(`⚡ Press Ctrl+C to stop`);

        const startTime = Date.now();

        try {
            // INFINITE LOOP
            while (true) {
                await this.processCycle();
                
                // Show total stats after each cycle
                const currentTime = Date.now();
                const totalTime = ((currentTime - startTime) / 1000).toFixed(2);
                
                console.log(`\n🏆 TOTAL STATS AFTER ${this.stats.totalCycles} CYCLES:`);
                console.log(`⏱️  Total Runtime: ${totalTime}s`);
                console.log(`🎫 Total Requests: ${this.stats.totalRequests}`);
                console.log(`✅ Total Success: ${this.stats.totalSuccess}`);
                console.log(`❌ Total Failed: ${this.stats.totalFailed}`);
                console.log(`📈 Overall Success Rate: ${((this.stats.totalSuccess / this.stats.totalRequests) * 100).toFixed(2)}%`);
                console.log(`🚀 Average Speed: ${(this.stats.totalRequests / parseFloat(totalTime)).toFixed(0)} req/s`);
                
                console.log(`\n⏳ Starting next cycle in 3 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
        } catch (error) {
            console.error('❌ Error occurred:', error);
        }
    }
}

function checkTokenFile() {
    if (!fs.existsSync('token.txt')) {
        console.log('⚠️  token.txt tidak ditemukan');
        const exampleTokens = [
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example1',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example2',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example3'
        ];
        fs.writeFileSync('token.txt', exampleTokens.join('\n'));
        console.log('📝 File token.txt dibuat. Silakan isi dengan token asli.');
        return false;
    }
    return true;
}

async function main() {
    if (!checkTokenFile()) return;
    
    const claimer = new SandchainQuestClaimer();
    await claimer.run();
}

process.on('SIGINT', () => {
    console.log('\n\n⚠️  Loop dihentikan oleh user');
    console.log('👋 Bye bye!');
    process.exit(0);
});

main().catch(console.error);
