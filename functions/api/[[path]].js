// functions/api/[[path]].js

export async function onRequest(context) {
    // context 包含了請求、環境變數等所有資訊
    const { request, env } = context;

    // 從環境變數中取得我們綁定的 KV 資料庫
    const db = env.FOOD_WHEEL_DB;
    // 取得我們綁定用於「日誌」的 KV 資料庫
    const logDb = env.yunlinfood_log;

    // 處理 GET 請求：取得所有餐廳資料
    if (request.method === "GET") {
        try {
            const foodDataJson = await db.get("restaurants");
            if (!foodDataJson) {
                // 如果沒有資料，回傳一個空的 JSON 物件，讓前端可以正常解析
                return new Response("{}", {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const headers = { 'Content-Type': 'application/json' };
            return new Response(foodDataJson, { headers });
        } catch (err) {
            return new Response(err.toString(), { status: 500 });
        }
    }

    // 處理 POST 請求：新增一家餐廳
    if (request.method === "POST") {
        try {
            const { restaurant, category } = await request.json();

            if (!restaurant || !restaurant.name || !category) {
                return new Response("新增的資料不完整", { status: 400 });
            }

            // 1. 從 KV 取出目前的完整資料
            const currentDataJson = await db.get("restaurants");
            const foodData = JSON.parse(currentDataJson || "{}");

            // 2. 在記憶體中更新資料
            if (foodData[category]) {
                foodData[category].push(restaurant);
            } else {
                foodData[category] = [restaurant];
            }

            // 3. 將更新後的完整資料寫回 KV
            await db.put("restaurants", JSON.stringify(foodData));

            // --- ✨ 新增日誌記錄到 KV ---
            // 確認日誌資料庫的綁定存在
            if (logDb) {
                const timestamp = new Date().toISOString();
                const logKey = `${timestamp}-${crypto.randomUUID()}`;

                const logValue = JSON.stringify({
                    timestamp: timestamp,
                    ipAddress: request.headers.get('cf-connecting-ip'), // 獲取真實訪客 IP
                    restaurantName: restaurant.name,
                    category: category,
                    description: restaurant.description,
                    url: restaurant.url,
                    userAgent: request.headers.get('user-agent') // 記錄 User Agent
                });

                // 使用 put() 方法將日誌寫入 yunlinfood_log
                // 使用 ctx.waitUntil 來確保即使在回傳回應後，寫入操作也能完成
                context.waitUntil(logDb.put(logKey, logValue));
            }
            // --- ✨ 日誌記錄結束 ---

            return new Response(JSON.stringify({ success: true, message: "新增成功" }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (err) {
            console.error(err); // 在後台印出詳細錯誤
            return new Response(err.toString(), { status: 500 });
        }
    }

    // 對於其他 HTTP 方法，回傳 405 Method Not Allowed
    return new Response("不支援的方法", { status: 405 });
}