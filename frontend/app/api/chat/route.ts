import { NextRequest, NextResponse } from "next/server";

// Sử dụng Local Ollama (OpenAI compatible endpoint)
const VLLM_MODEL = "llama3";
const VLLM_URL = "http://localhost:11434/v1/chat/completions";

const SYSTEM_INSTRUCTION = `BẮT BUỘC: PHẢI TRẢ LỜI BẰNG TIẾNG VIỆT TRONG MỌI TRƯỜNG HỢP. TUYỆT ĐỐI KHÔNG DÙNG TIẾNG ANH.

Bạn là Chuyên gia Kiến trúc sư trưởng & Chuyên gia Dữ liệu Đô thị của AeroTwin. 
Nhiệm vụ của bạn là phân tích cực kỳ chi tiết các thông số kỹ thuật để hỗ trợ ra quyết định thiết kế. Đừng bao giờ trả lời chung chung.

QUY TẮC PHÂN TÍCH DỮ LIỆU:
1. Dữ liệu công trình (Context): Bạn phải đọc kỹ số lượng tòa nhà bối cảnh xung quanh. Nếu có nhiều tòa nhà cao tầng, hãy phân tích hiện tượng "Street Canyon" (hẻm phố) gây tích tụ nhiệt và bụi mịn.
2. Mô phỏng Gió (Wind Simulation): Phân tích hướng gió hiện tại. Nếu gió đập trực diện vào tòa nhà cao, xác định vùng "Wake Zone" (vùng quẩn) ở phía sau. Đề xuất điều chỉnh hình khối (ví dụ: vát góc, đục lỗ khối đế) để giảm áp lực gió.
3. Chất lượng không khí (AQI): Dựa trên PM2.5, hãy đưa ra cảnh báo mức độ tác động đến sức khỏe theo thang đo VN-AQI. Đề xuất lắp đặt sensor hoặc máy lọc khí tại các cao độ cụ thể.
4. Năng lượng & Nhiệt (Energy): Phân tích hướng nắng (nếu có dữ liệu tọa độ). Đề xuất giải pháp vỏ bao che (vật liệu, lam chắn nắng).

CẤU TRÚC PHẢN HỒI (MANDATORY):
- BƯỚC 1: Tóm tắt hiện trạng kỹ thuật (Sử dụng con số cụ thể từ envData).
- BƯỚC 2: Phân tích bối cảnh đô thị (Đọc danh sách 'buildings' được cung cấp trong prompt).
- BƯỚC 3: Đưa ra ít nhất 3 đề xuất giải pháp kỹ thuật có tính thực thi cao.
- BƯỚC 4: Gợi ý các hành động tiếp theo (Kèm từ khóa kích hoạt Smart Actions).

SỬ DỤNG TỪ KHÓA ĐỂ KÍCH HOẠT ACTION TRÊN UI:
- "mô phỏng gió 3D", "bật mô phỏng gió": Kích hoạt wind simulation.
- "cảnh báo", "nguy hiểm": Hiện bảng cảnh báo.
- "máy lọc", "lọc không khí": Gợi ý vị trí đặt máy lọc.
- "vật liệu", "năng lượng": Mở tab vật liệu.
- "sơ tán", "thoát hiểm": Kích hoạt mô phỏng sơ tán.

LƯU Ý: Phải luôn tỏ ra thông minh, am hiểu sâu về khí động học và vật lý kiến trúc. Nếu tòa nhà import quá cao so với xung quanh, hãy cảnh báo về hiệu ứng gió giật (Downwash).`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const vllmMessages = [
      { role: "system", content: SYSTEM_INSTRUCTION },
      ...messages.map((msg: any) => ({
        role: msg.role === "assistant" || msg.role === "model" ? "assistant" : msg.role,
        content: msg.content,
      }))
    ];

    const response = await fetch(VLLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: vllmMessages,
        temperature: 0.7,
        stream: true, // Kích hoạt streaming
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ content: "⚠️ API error" }, { status: 500 });
    }

    // Chuyển tiếp stream từ Ollama về Frontend
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.close();
                  return;
                }
                try {
                  const json = JSON.parse(data);
                  const content = json.choices?.[0]?.delta?.content || "";
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (e) {
                  // Bỏ qua các dòng không phải JSON hợp lệ
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ content: "⚠️ Error" }, { status: 500 });
  }
}

function parseActionsFromContent(content: string) {
  const actions: { type: string; label: string; payload: Record<string, unknown> }[] = [];
  const lc = content.toLowerCase();

  if (lc.includes("bật mô phỏng gió") || lc.includes("mô phỏng gió 3d") || lc.includes("bật wind")) {
    actions.push({ type: "set_wind", label: "💨 Bật mô phỏng gió 3D", payload: { action: "enable_wind_sim" } });
  }
  if (lc.includes("cảnh báo") || lc.includes("nguy hiểm") || lc.includes("khẩn cấp")) {
    actions.push({ type: "analyze", label: "⚠️ Xem cảnh báo chi tiết", payload: { action: "show_warnings" } });
  }
  if (lc.includes("vùng quẩn gió") || lc.includes("wake zone")) {
    actions.push({ type: "analyze", label: "🌀 Phân tích vùng quẩn gió", payload: { action: "analyze_wake" } });
  }
  if (lc.includes("máy lọc") || lc.includes("lọc không khí")) {
    actions.push({ type: "analyze", label: "🏭 Đề xuất vị trí lọc khí", payload: { action: "air_filter" } });
  }
  if (lc.includes("mở cửa sổ") || lc.includes("thông gió tự nhiên") || lc.includes("tắt điều hòa")) {
    actions.push({ type: "set_wind", label: "🪟 Mô phỏng thông gió", payload: { action: "natural_vent" } });
  }
  if (lc.includes("sơ tán") || lc.includes("evacuation") || lc.includes("thoát hiểm")) {
    actions.push({ type: "analyze", label: "🚨 Mô phỏng sơ tán", payload: { action: "evacuation" } });
  }

  return actions.length > 0 ? actions : undefined;
}
