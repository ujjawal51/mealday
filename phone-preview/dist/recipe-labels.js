// Presentation-only corrections for known catalogue titles, including saved plans.
const bissaraNames=new Map([
 ['Fava Bissara Breakfast with Pita','Fava Bissara with Pita'],
 ['Fava Bissara Breakfast with Pita + Cucumber side','Fava Bissara with Pita + Cucumber side'],
]);
export function recipeLabel(id,name){
 return id==='target-ar-bissara'?(bissaraNames.get(name)??name):name;
}
