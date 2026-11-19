// Match the recipe library API's diet categories for on-device saved recipes.
const diets={Vegan:'vegan',Vegetarian:'vegetarian',Pescatarian:'fish','Non-vegetarian':'meat'};
export function filterSavedRecipes(recipes,{q='',cuisine='',diet=''}={}){
  const query=String(q).trim().slice(0,100).toLowerCase();
  return recipes.filter(recipe=>(!query||String(recipe.name||'').toLowerCase().includes(query))&&
    (!cuisine||recipe.cuisine===cuisine)&&(!diet||recipe.diet===diets[diet]));
}
