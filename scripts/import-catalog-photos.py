"""Importa fotos fornecidas pela Zangraf, sem alterar os arquivos originais."""
from pathlib import Path
import hashlib,json,re,shutil,unicodedata
root=Path(__file__).resolve().parents[1]
source=root/'.backups/fotos-site-original/FOTOS SITE'
target=root/'public/catalogo'
target.mkdir(parents=True,exist_ok=True)
normalize=lambda s:unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().upper()
natural=lambda p:[int(t) if t.isdigit() else t.lower() for t in re.split('(\\d+)',p.name)]
cover_names={'AR':('Antirrisco','antirrisco'),'ACRILICO':('Acrílico','acrilico'),'1500G':('1500 gramas','1500-gramas'),'PS':('PS','ps'),'TECIDO':('Tecido','tecido'),'VIDRO':('Vidro','vidro')}
preferred={
 '22X30/AR':'IMG_9741.jpg','24X30/AR':'IMG_9741.jpg',
 '24X24/AR':'IMG_9736.jpg','30X30/AR':'IMG_9736.jpg',
 '24X24/1500G':'IMG_9765.jpg','30X30/1500G':'IMG_9765.jpg',
 '24X24/ACRILICO':'IMG_9784.jpg','30X30/ACRILICO':'IMG_9784.jpg',
 '24X24/PS':'IMG_9779.jpg','30X30/PS':'IMG_9779.jpg',
 '30X22/AR':'03.jpg','34X24/AR':'03.jpg',
 '30X40/1500G':'13.jpg','30X40/AR':'03.jpg',
 '30X40/PS':'05 PS.jpg','30X40/VIDRO':'08.jpg',
}
products=[];provenance={}
def store_photo(path):
 data=path.read_bytes();digest=hashlib.sha256(data).hexdigest()[:24];ext=path.suffix.lower().replace('.jpeg','.jpg');name=digest+ext
 destination=target/name
 if not destination.exists():shutil.copyfile(path,destination)
 url='/catalogo/'+name
 provenance.setdefault(url,[]).append(str(path.relative_to(source)))
 return url
for size_dir in sorted(source.iterdir()):
 match=re.fullmatch(r'(\d+)X(\d+)',size_dir.name)
 if not match or not size_dir.is_dir():continue
 width,height=map(int,match.groups());size=f'{width} × {height} cm'
 for cover_dir in sorted(size_dir.iterdir()):
  if not cover_dir.is_dir():continue
  key=normalize(cover_dir.name)
  if key not in cover_names:continue
  label,slug=cover_names[key]
  paths=sorted([p for p in cover_dir.iterdir() if p.is_file() and p.suffix.lower() in ('.jpg','.jpeg','.png')],key=natural)
  first=preferred.get(size_dir.name+'/'+key)
  if first:paths.sort(key=lambda p:p.name!=first)
  images=list(dict.fromkeys(store_photo(p) for p in paths))
  if not images:continue
  products.append({'id':f'album-{width}x{height}-{slug}','name':f'Álbum {size} · {label}','category':label,'color':'#d3c4a8','kind':'album','isDemo':False,
   'description':f'Álbum {size} com capa {label.lower() if label!="PS" else label} e 15 lâminas (30 páginas). Personalize as capas e cada página no diagramador Zangraf.',
   'imageUrl':images[0],'imageUrls':images,'printSizes':[{'label':size,'widthMm':width*10,'heightMm':height*10,'bleedMm':3,'dpi':300}],
   'options':{'sizes':[size],'sheets':['15 lâminas'],'covers':[label],'finishes':[]}})
for width,height in [(24,24),(30,30),(34,24)]:
 paths=sorted((source/'ESTOJO/Fotos do iCloud').glob(f'{width}x{height} *.jpg'),key=natural)
 images=[store_photo(p) for p in paths]
 if images:
  size=f'{width} × {height} cm'
  products.append({'id':f'estojo-{width}x{height}','name':f'Estojo para álbum {size}','category':'Estojos','color':'#b6a58d','kind':'case','isDemo':False,
   'description':f'Estojo para apresentação do álbum {size}. Veja as fotos do conjunto e consulte a Zangraf sobre materiais e composição do pedido.',
   'imageUrl':images[0],'imageUrls':images,'options':{'sizes':[size],'sheets':[],'covers':[],'finishes':[]}})
products.sort(key=lambda p:(0 if p['id']=='album-24x34-antirrisco' else 1 if p['kind']=='album' else 2,p['category'],p['name']))
(root/'src/lib/catalogo-real.json').write_text(json.dumps(products,ensure_ascii=False,indent=2)+'\n')
(root/'docs/FOTOS-CATALOGO.json').write_text(json.dumps({'source':'FOTOS SITE.rar, fornecido pelo usuário','date':'2026-10-19','files':provenance},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'products':len(products),'albums':sum(p['kind']=='album' for p in products),'cases':sum(p['kind']=='case' for p in products),'photos':len(provenance),'bytes':sum((root/'public'/p.lstrip('/')).stat().st_size for p in provenance)},ensure_ascii=False))
