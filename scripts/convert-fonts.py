from pathlib import Path
import xml.etree.ElementTree as E,json,re
from fontTools.svgLib.path import parse_path
from fontTools.pens.basePen import BasePen
class FlatPen(BasePen):
 def __init__(self):super().__init__(None);self.strokes=[]
 def _moveTo(self,p):self.strokes.append([p])
 def _lineTo(self,p):self.strokes[-1].append(p)
 def _curveToOne(self,a,b,c):
  p=self._getCurrentPoint()
  for i in range(1,17):
   t=i/16;u=1-t;self.strokes[-1].append(tuple(u**3*p[j]+3*u*u*t*a[j]+3*u*t*t*b[j]+t**3*c[j] for j in (0,1)))
 def _qCurveToOne(self,a,b):
  p=self._getCurrentPoint()
  for i in range(1,17):
   t=i/16;u=1-t;self.strokes[-1].append(tuple(u*u*p[j]+2*u*t*a[j]+t*t*b[j] for j in (0,1)))
 def _closePath(self):
  if self.strokes[-1][-1]!=self.strokes[-1][0]:self.strokes[-1].append(self.strokes[-1][0])
 def _endPath(self):pass
root=Path(__file__).resolve().parents[1]/"font-sources"
out=root.parent/"dist/fonts"
def points(pen):
 return [[[round(x,4),round(y,4)] for x,y in s] for s in pen.strokes if len(s)>1]
for f in root.glob('*.svg'):
 tree=E.parse(f);font=tree.find('.//{*}font');face=tree.find('.//{*}font-face');glyphs={}
 for g in font.findall('{*}glyph'):
  ch=g.get('unicode')
  if not ch or len(ch)!=1:continue
  pen=FlatPen();parse_path(g.get('d',''),pen)
  glyphs[ch]={'advance':float(g.get('horiz-adv-x',font.get('horiz-adv-x','0'))),'strokes':points(pen)}
 data={'name':face.get('font-family'),'unitsPerEm':float(face.get('units-per-em')),'credit':''.join(tree.find('.//{*}metadata').itertext()).strip(),'glyphs':glyphs}
 if f.stem=='Relief':
  # Only letter variants from the documented stylistic sets. Exclude numerals,
  # punctuation, localized glyphs and ligatures from automatic alternation.
  names={g.get('glyph-name'):g.get('unicode') for g in font.findall('{*}glyph') if g.get('unicode') in glyphs}
  variants={}
  for g in font.findall('{*}glyph'):
   match=re.fullmatch(r'(.+)\.(ss0[123])',g.get('glyph-name',''))
   if not match or match[1] not in names or match[1]=='fl':continue
   ch=names[match[1]];pen=FlatPen();parse_path(g.get('d',''),pen)
   variants.setdefault(ch,[]).append({'name':g.get('glyph-name'),'feature':match[2],'advance':float(g.get('horiz-adv-x',font.get('horiz-adv-x','0'))),'strokes':points(pen)})
  data['nativeVariants']=variants
 (out/(f.stem+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 print(f.stem,len(glyphs),'missing',set('ÄÖÜäöüß€')-set(glyphs))

# Mistral stores real open pen paths in the SVG table of its OTF-SVG font.
# The CFF outlines are deliberately not used for the pen output.
from fontTools.ttLib import TTFont
f=TTFont(root/'Mistral.otf');names=f.getGlyphOrder();by_name={}
for doc in f['SVG '].docList:
 assert doc.startGlyphID==doc.endGlyphID
 tree=E.fromstring(doc.data)
 assert all(el.get('transform') in (None,'matrix(1 0 0 -1 0 0)') for el in tree.iter())
 pen=FlatPen()
 for path in tree.findall('.//{*}path'):
  assert path.get('transform') is None
  # These paths already use font coordinates (positive Y upwards); the outer
  # SVG Y-flip is for display only, so it must not be applied to font geometry.
  parse_path(path.get('d',''),pen)
 name=names[doc.startGlyphID];by_name[name]={'advance':f['hmtx'][name][0],'strokes':points(pen)}
cmap=f.getBestCmap();glyphs={chr(code):by_name[name] for code,name in cmap.items() if name in by_name}
chars_by_name={}
for code,name in cmap.items():chars_by_name.setdefault(name,[]).append(chr(code))
variants={};seen=set();gsub=f['GSUB'].table
for feature in gsub.FeatureList.FeatureRecord:
 if feature.FeatureTag not in {'ss03','ss04','ss05','ss06','ss07','ss08','ss09'}:continue
 for idx in feature.Feature.LookupListIndex:
  lookup=gsub.LookupList.Lookup[idx];assert lookup.LookupType==1
  for table in lookup.SubTable:
   for base,alternate in table.mapping.items():
    for ch in chars_by_name.get(base,[]):
     if (ch,alternate) in seen:continue
     seen.add((ch,alternate));variants.setdefault(ch,[]).append({'name':alternate,'feature':feature.FeatureTag,**by_name[alternate]})
data={'name':'Mistral SingleLine','unitsPerEm':f['head'].unitsPerEm,'credit':(root/'Mistral-AUTHORS.txt').read_text(),'glyphs':glyphs,'nativeVariants':variants}
(out/'Mistral.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print('Mistral',len(glyphs),'native alternatives',sum(map(len,variants.values())),'characters',''.join(variants),'missing',set('ÄÖÜäöüß€')-set(glyphs))
