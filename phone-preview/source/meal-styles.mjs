// Explicit planning rules, not medical or nutritional suitability guarantees.
export function matchedMealStyles(recipe,stock,nutrition,minutes){
 const items=recipe.items.map(([id,amount])=>({id,amount,...stock[id]}));
 const staple=items.some(i=>/\b(rice|pasta|potato|bread|wrap|noodle|roti|couscous)\b/i.test(i.name||''));
 const vegetables=items.reduce((n,i)=>n+(i.category==='Vegetables'&&i.unit==='g'?i.amount:0),0);
 const warm=recipe.appliances.some(a=>['Hob','Oven','Microwave','Air fryer'].includes(a));
 return [minutes<=30?'Quick':null,minutes<=60&&items.length<=15?'Everyday':null,
  minutes<=45&&staple?'Family':null,warm&&(staple||items.some(i=>/\b(lentil|bean|chickpea)s?\b/i.test(i.name||'')))?'Comfort':null,
  vegetables>=150&&nutrition.complete&&nutrition.totals.kcal<=600?'Fresh':null,
  nutrition.complete&&nutrition.totals.protein>=25?'Protein':null].filter(Boolean);
}
