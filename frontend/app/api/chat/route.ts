import { NextRequest, NextResponse } from "next/server";

// Cấu hình AI Backend - Ưu tiên Groq (Free & Siêu nhanh) hoặc Ollama Local
const AI_URL = process.env.AI_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "llama-3.3-70b-versatile";
const AI_KEY = process.env.AI_API_KEY || "";

const SYSTEM_INSTRUCTION = `BẮT BUỘC: PHẢI TRẢ LỜI BẰNG TIẾNG VIỆT TRONG MỌI TRƯỜNG HỢP. 

Bạn là Chuyên gia Cao cấp về Vật lý Kiến trúc & Khí động học Đô thị (Urban Aerodynamics Expert) của AeroTwin. 
Nhiệm vụ của bạn là thực hiện các báo cáo phân tích kỹ thuật cực kỳ chuyên sâu, mang tính học thuật và thực tiễn cao để hỗ trợ các kiến trúc sư trưởng.

PHONG CÁCH TRẢ LỜI:
- Trình bày như một bản báo cáo khoa học. 
- Sử dụng các thuật ngữ chuyên môn: Lớp biên khí quyển (ABL), Hiệu ứng Venturi, Hiệu ứng Downwash (gió giật khối đế), Street Canyon (hẻm phố đô thị), Đảo nhiệt đô thị (UHI), Tiện nghi nhiệt (Thermal Comfort), Hệ số nhám bề mặt.
- Trả lời THẬT DÀI và CHI TIẾT. Đừng bao giờ tóm tắt quá ngắn gọn.

QUY TẮC PHÂN TÍCH BỐI CẢNH ĐÔ THỊ:
1. Phân tích mật độ (Density): Dựa vào danh sách 'buildings' và tọa độ, hãy nhận xét khu vực này là mật độ cao, trung bình hay thấp. Nếu có nhiều tòa nhà cao tầng san sát, hãy phân tích sự cản trở luồng gió tự nhiên.
2. Phân tích Hình khối (Morphology): Nhận diện các tòa nhà cao bất thường so với xung quanh để cảnh báo về hiện tượng gió đập mạnh vào bề mặt và đổ xuống khối đế gây nguy hiểm cho người đi bộ.
3. Phân tích hướng gió: Kết hợp hướng gió thực tế với vị trí các tòa nhà bối cảnh để xác định chính xác khu vực nào sẽ bị bí khí (Wake Zone).

CẤU TRÚC PHẢN HỒI (MANDATORY):
- PHẦN 1: ĐÁNH GIÁ HIỆN TRẠNG KỸ THUẬT (Sử dụng các con số cụ thể PM2.5, Wind Speed từ envData).
- PHẦN 2: PHÂN TÍCH CHI TIẾT BỐI CẢNH ĐÔ THỊ (Phân tích hình thái đô thị dựa trên danh sách tòa nhà được cung cấp. Phải nhắc đến các thông số chiều cao của bối cảnh).
- PHẦN 3: MÔ PHỎNG VẬT LÝ & KHÍ ĐỘNG HỌC (Dự báo luồng gió và chất lượng không khí dựa trên lý thuyết khí động học).
- PHẦN 4: ĐỀ XUẤT GIẢI PHÁP KIẾN TRÚC CHUYÊN SÂU (Đưa ra ít nhất 3-5 giải pháp chi tiết về: điều chỉnh hình khối, vật liệu bao che, rèm thông minh, hoặc mảng xanh lọc bụi).
- PHẦN 5: SMART ACTIONS (Gợi ý các hành động kích hoạt UI).

LƯU Ý: Phải luôn tỏ ra thông minh và am hiểu sâu. Không trả lời chung chung kiểu "hãy trồng thêm cây". Phải nói rõ "trồng cây ở cao độ nào, mật độ bao nhiêu để tối ưu hóa màng lọc sinh học".`;

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

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(AI_KEY ? { "Authorization": `Bearer ${AI_KEY}` } : {})
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: vllmMessages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Groq/AI Provider Error:", errorData);
      return NextResponse.json(
        { content: `⚠️ AI Provider Error: ${response.status} ${errorData.error?.message || response.statusText}` },
        { status: response.status }
      );
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
