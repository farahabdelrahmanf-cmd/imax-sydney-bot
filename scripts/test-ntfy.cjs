const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

(async () => {
  const topic = "test-probe-farah-imax-" + Math.floor(Math.random() * 10000);
  console.log("Sending test push notification via JSON to https://ntfy.sh");

  try {
    const res = await fetch(`https://ntfy.sh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        topic: topic,
        title: "IMAX SYDNEY TICKET HELD!",
        message: "🚨 Coca-Cola Box secured for The Odyssey! Complete payment now.",
        priority: 5,
        tags: ["tada", "tickets", "warning"],
        click: "https://www.eventcinemas.com.au/cinema/imax-sydney"
      })
    });

    console.log("Response status:", res.status);
    const json = await res.json();
    console.log("Response JSON:", json);
    console.log("ntfy JSON test SUCCESSFUL!");
  } catch (err) {
    console.error("ntfy test FAILED:", err);
  }
})();
