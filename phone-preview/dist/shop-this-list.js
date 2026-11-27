// Public storefront links only. No products, address or account data go in the URLs.
export const groceryProviders=Object.freeze([
 Object.freeze({name:'noon Minutes',url:'https://minutes.noon.com/uae-en/'}),
 Object.freeze({name:'talabat mart',url:'https://www.talabat.com/uae/talabat-mart'}),
]);
const number=new Intl.NumberFormat('en-AE',{maximumFractionDigits:3});
export function shopListLines(items,checked,extras){
 const bought=new Set(checked);
 return [...items.filter(x=>!bought.has(x.key)&&Number.isFinite(x.need)&&x.need>0&&x.packs>0)
  .map(x=>x.name+' — '+number.format(x.need)+' '+x.unit),
  ...extras.filter(x=>!x.checked).map(x=>x.name+(x.quantity?' — '+x.quantity:''))
 ];
}
