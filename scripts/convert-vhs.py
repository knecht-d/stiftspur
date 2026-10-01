"""Convert the separately recorded VHS font1 glyphs (AGPL-3.0).

Keep raw stroke geometry and common baseline. Only remove consecutive duplicate
samples, translate each glyph to its left bearing and round to 0.0001 units.
No synthetic alternates, inferred missing letters or borrowed application code.
"""
from pathlib import Path
import json, zipfile

root=Path(__file__).resolve().parents[1]
source=root/'font-sources/VHSHand-source.json'
data=json.loads(source.read_text())
glyphs={' ':{'advance':35,'strokes':[]}}
variants={}
for record in data['glyphs']:
    ch=record['char']
    assert len(ch)==1
    forms=[]
    for variant in record['variants']:
        strokes=[]
        for stroke in variant['strokes']:
            points=[[p['x'],record['metadata']['baseline_y']-p['y']] for p in stroke]
            points=[p for i,p in enumerate(points) if i==0 or p!=points[i-1]]
            # Preserve a tap as a zero-length round-capped stroke (e.g. period).
            if points:strokes.append(points if len(points)>1 else [points[0],points[0]])
        assert strokes
        min_x=min(p[0] for s in strokes for p in s)
        max_x=max(p[0] for s in strokes for p in s)
        forms.append({'advance':round(max_x-min_x+10,4),'strokes':[[[round(x-min_x,4),round(y,4)] for x,y in s] for s in strokes]})
    assert len(forms)==7
    glyphs[ch]=forms[0]
    variants[ch]=[{'name':ch+'.recording'+str(i+2),**form} for i,form in enumerate(forms[1:])]
output={'name':'VHS Hand','unitsPerEm':100,'credit':'VHS contributors / utrost. Sample font1. AGPL-3.0. Converted for Stiftspur, 2026-10-01.','glyphs':glyphs,'nativeVariants':variants}
(root/'dist/fonts/VHSHand.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
# Ship the exact original records and this converter alongside the derived font.
with zipfile.ZipFile(root/'dist/fonts/VHSHand-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for path,name in [(source,'font-sources/VHSHand-source.json'),(Path(__file__),'scripts/convert-vhs.py'),(root/'dist/fonts/VHSHand-LICENSE.txt','dist/fonts/VHSHand-LICENSE.txt')]:
        entry=zipfile.ZipInfo(name,date_time=(2026,10,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(entry,path.read_bytes())
print(f'VHS Hand: {len(variants)} characters with seven recorded forms each; Y absent in source.')
