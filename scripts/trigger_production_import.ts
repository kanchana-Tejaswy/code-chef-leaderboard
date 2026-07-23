async function triggerPreview() {
  console.log("=== TRIGGERING API IMPORT PREVIEW ON VERCEL PRODUCTION ===");

  const targetUrl = "https://code-chef-leaderboard.vercel.app/api/students/import";
  const body = {
    action: "preview",
    rows: [
      {
        name: "Test Schema Initialization",
        rollNumber: "INIT001",
        email: "init001@ace.edu.in",
        year: 3,
        department: "CSE",
      },
    ],
  };

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log(`HTTP Response Status: ${res.status} ${res.statusText}`);
    const resData = await res.json();
    console.log("API Response:", JSON.stringify(resData, null, 2));
  } catch (err: any) {
    console.error("Fetch Error:", err.message);
  }
}

triggerPreview();
