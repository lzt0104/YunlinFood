// functions/api/[[path]].js

export async function onRequest(context) {
    // context 包含了請求、環境變數等所有資訊
    const { request, env } = context;

    // 從環境變數中取得我們綁定的 KV 資料庫
    const db = env.FOOD_WHEEL_DB;
    // 日誌儲存桶 (R2)
    const logBucket = env.LOG_BUCKET;

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

    /// 處理 POST 請求
    if (request.method === "POST") {
        try {
            const { restaurant, category } = await request.json();

            if (!restaurant || !restaurant.name || !category) {
                return new Response("新增的資料不完整", { status: 400 });
            }

            // --- 主要資料庫操作 (不變) ---
            const currentDataJson = await db.get("restaurants");
            const foodData = JSON.parse(currentDataJson || "{}");
            if (!foodData[category]) foodData[category] = [];
            foodData[category].push(restaurant);
            await db.put("restaurants", JSON.stringify(foodData));
            // --- 主要資料庫操作結束 ---


            // --- ✨ 新增日誌到 R2 的 log.json ---
            if (logBucket) {
                // 1. 從 R2 讀取現有的 log.json
                const logFileObject = await logBucket.get('log.json');
                let logs = [];
                if (logFileObject) {
                    logs = await logFileObject.json(); // 解析成陣列
                }

                // 2. 準備新的日誌內容並加入陣列
                const newLogEntry = {
                    timestamp: new Date().toISOString(),
                    ipAddress: request.headers.get('cf-connecting-ip'),
                    restaurantName: restaurant.name,
                    category: category,
                };
                logs.push(newLogEntry);

                // 3. 將更新後的完整陣列寫回 R2 的 log.json
                // 使用 ctx.waitUntil 讓它在背景完成
                context.waitUntil(
                    logBucket.put('log.json', JSON.stringify(logs, null, 2))
                );
            }
            // --- ✨ R2 日誌記錄結束 ---

            return new Response(JSON.stringify({ success: true, message: "新增成功" }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (err) {
            console.error(err);
            return new Response(err.toString(), { status: 500 });
        }
    }

    return new Response("不支援的方法", { status: 405 });
}