import "dotenv/config";

// Toggle this to switch between sandbox and live
const USE_SANDBOX = true;

const API_KEY = USE_SANDBOX 
  ? process.env.AFRICASTALKING_SANDBOX_API_KEY 
  : process.env.AFRICASTALKING_API_KEY;
const USERNAME = USE_SANDBOX ? "sandbox" : process.env.AFRICASTALKING_USERNAME;
const API_URL = USE_SANDBOX 
  ? "https://api.sandbox.africastalking.com/version1/messaging"
  : "https://api.africastalking.com/version1/messaging";

async function sendSMS(phoneNumber, message) {
  console.log("\n=== Configuration ===");
  console.log("Mode:", USE_SANDBOX ? "SANDBOX" : "LIVE");
  console.log("API URL:", API_URL);
  console.log("Username:", USERNAME);
  console.log("API Key (full):", API_KEY);
  
  try {
    // Use form-urlencoded format matching the curl example
    const params = new URLSearchParams({
      username: USERNAME,
      to: phoneNumber,
      message: message,
    });

    console.log("\n=== Request Body ===");
    console.log(params.toString());

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "apiKey": API_KEY,
      },
      body: params.toString(),
    });

    const text = await response.text();
    console.log("\n=== Response ===");
    console.log("Status:", response.status);
    
    try {
      const data = JSON.parse(text);
      console.log("Body:", JSON.stringify(data, null, 2));
      return data;
    } catch {
      console.log("Raw:", text);
      return text;
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// Test messages to multiple numbers
const testNumbers = [
  "+254725101001",
  "+254793841389"
];
const testMessage = "Hello from OHMKenya! This is a test message.";

console.log("=== Test SMS ===");
console.log("Message:", testMessage);

for (const phone of testNumbers) {
  console.log("\n--- Sending to:", phone, "---");
  await sendSMS(phone, testMessage);
}
