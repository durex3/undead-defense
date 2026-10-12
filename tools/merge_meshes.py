"""Merge identity-transform skinned mesh nodes by skin/material, preserving all bones.
No simplification or changes to skin weights. Useful for modular KayKit characters.
"""
import struct,copy
FORMATS={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
SIZES={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def merge_meshes(j,b):
 def read(idx):
  a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];fmt='<'+FORMATS[a['componentType']]*SIZES[a['type']];size=struct.calcsize(fmt);stride=v.get('byteStride',size);off=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,b,off+i*stride) for i in range(a['count'])]
 groups={}
 for ni,n in enumerate(j['nodes']):
  if 'mesh' not in n or 'skin' not in n:continue
  if any(k in n for k in ['matrix','translation','rotation','scale']):continue
  primitives=j['meshes'][n['mesh']]['primitives']
  if len(primitives)!=1:continue
  p=primitives[0];key=(n['skin'],p.get('material'),tuple(sorted(p['attributes'])))
  groups.setdefault(key,[]).append((ni,p))
 count=0
 for key,group in groups.items():
  if len(group)<2:continue
  merged={k:[] for k in group[0][1]['attributes']};indices=[];offset=0
  for ni,p in group:
   for attr,idx in p['attributes'].items():merged[attr]+=read(idx)
   indices += [v[0]+offset for v in read(p['indices'])];offset+=j['accessors'][p['attributes']['POSITION']]['count']
  def write(values,component,kind):
   nonlocal b
   fmt='<'+FORMATS[component]*SIZES[kind];raw=b''.join(struct.pack(fmt,*v) for v in values);b+=b'\0'*((-len(b))%4);vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(raw)});b+=raw
   a={'bufferView':vi,'componentType':component,'count':len(values),'type':kind}
   if kind=='VEC3':a['min']=[min(v[i] for v in values) for i in range(3)];a['max']=[max(v[i] for v in values) for i in range(3)]
   idx=len(j['accessors']);j['accessors'].append(a);return idx
  attrs={}
  for attr,values in merged.items():
   ref=j['accessors'][group[0][1]['attributes'][attr]];attrs[attr]=write(values,ref['componentType'],ref['type'])
  prim={'attributes':attrs,'indices':write([(v,) for v in indices],5125 if offset>65535 else 5123,'SCALAR'),'material':key[1]}
  mi=len(j['meshes']);j['meshes'].append({'name':'Merged_'+str(count),'primitives':[prim]});j['nodes'][group[0][0]]['mesh']=mi
  for ni,p in group[1:]:j['nodes'][ni].pop('mesh');j['nodes'][ni].pop('skin')
  count+=len(group)-1
 return j,b,count
