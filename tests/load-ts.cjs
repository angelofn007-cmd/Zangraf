const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
module.exports=function load(filename){
 const full=path.resolve(filename);if(cache.has(full))return cache.get(full).exports;
 if(full.endsWith('.json'))return JSON.parse(fs.readFileSync(full,'utf8'));
 const mod={exports:{}};cache.set(full,mod);
 const source=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const localRequire=name=>{if(name.startsWith('.')||name.startsWith('@/')){let file=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(full),name);if(!path.extname(file))file+='.ts';return module.exports(file);}return require(name);};
 new Function('require','module','exports',source)(localRequire,mod,mod.exports);return mod.exports;
};
