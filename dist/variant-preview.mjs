// Unmodified font geometry, all drawings shown at the same scale and baseline.
export function variantPreviews(font,ch){
 const variants=font.nativeVariants?.[ch];if(!variants?.length)return [];
 const glyphs=[font.getStrokeGlyph(ch),...variants],points=glyphs.flatMap(g=>g.strokes.flat());
 const u=font.unitsPerEm,minX=Math.min(0,...points.map(p=>p[0]))-.12*u,maxX=Math.max(...glyphs.map(g=>g.advance),...points.map(p=>p[0]))+.12*u;
 const minY=Math.min(-.85*u,...points.map(p=>-p[1]))-.12*u,maxY=Math.max(.15*u,...points.map(p=>-p[1]))+.12*u;
 return glyphs.map((g,index)=>({label:index?'Alternative '+index:'Original',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}" role="img" aria-label="${index?'Alternative '+index:'Original'}"><g fill="none" stroke="#182434" stroke-width="${u*.017}" stroke-linecap="round" stroke-linejoin="round">${g.strokes.map(s=>`<path d="M ${s.map(([x,y])=>`${x},${-y}`).join(' L ')}"/>`).join('')}</g></svg>`}));
}
