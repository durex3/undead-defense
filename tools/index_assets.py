from pathlib import Path
import json
r=Path(__file__).resolve().parents[1];out={}
for p in (r/'assets/resources/models').rglob('*.meta'):
 j=json.loads(p.read_text())
 for v in j.get('subMetas',{}).values():
  if v.get('importer')=='gltf-scene':out[p.name.split('.')[0]]=v['uuid']
(r/'assets/scripts/presentation/AssetIndex.ts').write_text('export const MODELS: Record<string,string> = '+json.dumps(out,indent=2)+';\n')
print('Indexed',len(out),'prefabs')
