"""Copy selected CC0 KayKit assets and merge compatible named skeletal clips.
Original purchased files are read-only. Each animation channel must map to a target bone.
"""
from pathlib import Path
import json,struct,copy,shutil
from merge_meshes import merge_meshes
ROOT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/liugelong/Desktop/purchased')
OUT=ROOT/'assets/resources/models';OUT.mkdir(parents=True,exist_ok=True)
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def save(p,j,b):
 j['buffers']=[{'byteLength':len(b)}]; raw=json.dumps(j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);b+=b'\0'*((-len(b))%4)
 p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(raw)+len(b))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(b),0x004e4942)+b)
def merge(src,out,rig,clips):
 j,b=read(src); names={n.get('name'):i for i,n in enumerate(j['nodes'])};j['animations']=[]
 for pack,wanted in clips:
  ap=next((SRC/'KayKit_Character_Animations_1.1').rglob(rig+'_'+pack+'.glb'));a,ab=read(ap)
  for anim in a.get('animations',[]):
   if anim['name'] not in wanted:continue
   anim=copy.deepcopy(anim); amap={}; vmap={}
   for sampler in anim['samplers']:
    for key in ['input','output']:
     idx=sampler[key]
     if idx not in amap:
      acc=copy.deepcopy(a['accessors'][idx]); vi=acc['bufferView']
      if vi not in vmap:
       view=copy.deepcopy(a['bufferViews'][vi]);start=view.get('byteOffset',0);payload=ab[start:start+view['byteLength']];b+=b'\0'*((-len(b))%4);view['byteOffset']=len(b);view['buffer']=0;vmap[vi]=len(j['bufferViews']);j['bufferViews'].append(view);b+=payload
      acc['bufferView']=vmap[vi];amap[idx]=len(j['accessors']);j['accessors'].append(acc)
     sampler[key]=amap[idx]
   for c in anim['channels']:
    name=a['nodes'][c['target']['node']]['name'];assert name in names,(src,name);c['target']['node']=names[name]
   j['animations'].append(anim)
 j,b,reduced=merge_meshes(j,b);print('Merged draw meshes',src.stem,reduced);save(out,j,b);return [a['name'] for a in j['animations']]
manifest=[]
chars=[('Engineer',SRC/'KayKit_Adventurers_2.0_EXTRA/Characters/gltf/Engineer.glb','Rig_Medium')]+[(n,SRC/'KayKit_Skeletons_1.1_EXTRA/characters/gltf'/f'{n}.glb','Rig_Large' if n=='Skeleton_Golem' else 'Rig_Medium') for n in ['Skeleton_Minion','Skeleton_Rogue','Skeleton_Warrior','Skeleton_Mage','Skeleton_Golem']]
for name,p,rig in chars:
 clips=[('General',['Idle_A','Death_A','Hit_A']),('MovementBasic',['Walking_A','Running_A'])]
 if name=='Engineer':clips+=[('CombatRanged',['Ranged_2H_Shooting','Ranged_2H_Aiming'])]
 names=merge(p,OUT/(name+'.glb'),rig,clips);manifest.append({'asset':name,'source':str(p),'license':'CC0','animations':names});print(name,names)
# Props already contain embedded materials and textures.
props=list((SRC/'KayKit_Dungeon_Pack_1.1_EXTRA').rglob('*.gltf'))
for stem in ['floor_tile_large','wall','column','barrel','chest','torch']:
 matches=[p for p in props if p.stem==stem]
 if matches:
  p=matches[0];j=json.loads(p.read_text());dest=OUT/'props';dest.mkdir(exist_ok=True)
  shutil.copy2(p,dest/p.name)
  for item in j.get('buffers',[])+j.get('images',[]):
   uri=item.get('uri','')
   if uri and not uri.startswith('data:'):shutil.copy2(p.parent/uri,dest/uri)
  manifest.append({'asset':stem,'source':str(p),'license':'CC0'})
(ROOT/'assets/asset-provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
licenses=ROOT/'licenses';licenses.mkdir(exist_ok=True)
for name in ['KayKit_Adventurers_2.0_EXTRA','KayKit_Skeletons_1.1_EXTRA','KayKit_Dungeon_Pack_1.1_EXTRA']:
 shutil.copy2(SRC/name/'License.txt',licenses/(name+'.txt'))
