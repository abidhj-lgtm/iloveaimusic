import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import React from 'react'; // Explicit import for Edge runtime JSX

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const title = searchParams.get('title') || 'I Love AI Music';
    const subtitle = searchParams.get('subtitle') || 'Discover AI-generated tracks';
    const type = searchParams.get('type') || 'track';
    let imageUrl = searchParams.get('image');

    // Resolve relative image URLs to absolute (required by next/og)
    if (imageUrl && imageUrl.startsWith('/')) {
      imageUrl = `${req.nextUrl.origin}${imageUrl}`;
    }

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: '#0a0712',
            color: '#f4efff',
            padding: '48px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #7c3aed, #ec4899, #fbbf24)',
                borderRadius: '12px',
              }}
            />
            <span style={{ fontSize: '28px', fontWeight: 'bold' }}>I Love AI Music</span>
          </div>
          
          <div style={{ display: 'flex', gap: '40px', flex: 1, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                style={{
                  fontSize: '18px',
                  textTransform: 'uppercase',
                  letterSpacing: '3px',
                  color: '#a8a29e',
                  marginBottom: '20px',
                  fontWeight: 600,
                }}
              >
                {type}
              </div>
              <div style={{ fontSize: '56px', fontWeight: 'bold', lineHeight: '1.1', marginBottom: '20px', wordBreak: 'break-word' }}>
                {title}
              </div>
              <div style={{ fontSize: '28px', color: '#a8a29e', fontWeight: 500, wordBreak: 'break-word' }}>{subtitle}</div>
            </div>
            
            {imageUrl && (
              <div
                style={{
                  width: '320px',
                  height: '320px',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
                  border: '2px solid #2a2635',
                  flexShrink: 0,
                }}
              >
                <img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Cover" />
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error('OG Image generation failed:', e);
    return new Response(`Failed to generate the image`, { status: 500 });
  }
}