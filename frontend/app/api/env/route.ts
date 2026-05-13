import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const apiKey = process.env.OPENWEATHER_API_KEY || process.env.NEXT_PUBLIC_OPENWEATHERMAP_KEY;

  if (!apiKey) {
    // Nếu chưa có Key, trả về dữ liệu mẫu để demo không bị lỗi
    return NextResponse.json({
      wind: { speed: 3.5, deg: 180 },
      weather: { temp: 28, humidity: 75 },
      pollution: { pm2_5: 12.5, aqi: 1 }
    });
  }

  try {
    const [weatherRes, pollutionRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${apiKey}`)
    ]);

    const weatherData = await weatherRes.json();
    const pollutionData = await pollutionRes.json();

    return NextResponse.json({
      wind: { 
        speed: weatherData.wind?.speed || 0, 
        deg: weatherData.wind?.deg || 0 
      },
      weather: { 
        temp: weatherData.main?.temp || 0, 
        humidity: weatherData.main?.humidity || 0 
      },
      pollution: { 
        pm2_5: pollutionData.list?.[0]?.components?.pm2_5 || 0, 
        aqi: pollutionData.list?.[0]?.main?.aqi || 0 
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
