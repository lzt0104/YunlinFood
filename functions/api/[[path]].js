// functions/api/[[path]].js

export async function onRequest(context) {
    // context 包含了請求、環境變數等所有資訊
    const { request, env } = context;

    // 從環境變數中取得我們綁定的 KV 資料庫
    // *** 您需要在 Cloudflare Pages 的設定中，將 KV 命名空間綁定到這個專案 ***
    // *** 綁定後的變數名稱就是 "FOOD_WHEEL_DB" ***
    const db = env.FOOD_WHEEL_DB;

    // 處理 GET 請求：取得所有餐廳資料
    if (request.method === "GET") {
        try {
            const foodDataJson = await db.get("restaurants");
            if (!foodDataJson) {
                return new Response("找不到餐廳資料", { status: 404 });
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

            if (!restaurant || !category) {
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

            return new Response(JSON.stringify({ success: true, message: "新增成功" }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (err) {
             return new Response(err.toString(), { status: 500 });
        }
    }

    // 對於其他 HTTP 方法，回傳 405 Method Not Allowed
    return new Response("不支援的方法", { status: 405 });
}