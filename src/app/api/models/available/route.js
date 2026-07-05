import { NextResponse } from "next/server";
import { buildModelsList } from "@/app/api/v1/models/route";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // "llm" is the default kind we check to show available chat models
    const data = await buildModelsList(["llm"]);
    return NextResponse.json({ models: data });
  } catch (error) {
    console.error("Error fetching available models list for dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch available models", details: error.message },
      { status: 500 }
    );
  }
}