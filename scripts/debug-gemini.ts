
// Load environment variables
process.loadEnvFile();

async function main() {
    console.log("Checking Google AI Models...");
    if (!process.env.GOOGLE_API_KEY) {
        console.error("❌ GOOGLE_API_KEY is missing from environment");
        process.exit(1);
    }

    try {
        // Check available models via REST API
        console.log("\nFetching available models via REST API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);

        if (!response.ok) {
            console.error(`REST API Failed: ${response.status} ${response.statusText}`);
            console.error(await response.text());
        } else {
            const data = await response.json();
            console.log("\nAvailable Models:");
            // @ts-ignore
            data.models?.forEach((m: any) => {
                if (m.supportedGenerationMethods?.includes("generateContent")) {
                    console.log(`- ${m.name} (${m.displayName})`);
                }
            });
        }

    } catch (e) {
        console.error("Fatal error:", e);
    }
}

main();
