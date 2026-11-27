export function localDay(date=new Date()){
 return [date.getFullYear(),date.getMonth()+1,date.getDate()].map((v,i)=>i?String(v).padStart(2,'0'):String(v)).join('-');
}
export function validCalorie(value){return Number.isInteger(value)&&value>=1&&value<=10000;}
export function calorieRows(value){
 return Array.isArray(value)?value.filter(r=>typeof r?.id==='string'&&typeof r.name==='string'&&r.name.length>0&&r.name.length<=100&&/^\d{4}-\d{2}-\d{2}$/.test(r.day)&&validCalorie(r.kcal)&&['Manual','Recipe estimate','Photo estimate'].includes(r.source)).slice(0,500):[];
}
export function recipeCalories(nutrition,servings){
 if(!nutrition?.complete||!Number.isFinite(nutrition.totals?.kcal)||!Number.isFinite(servings)||servings<.1||servings>12)return null;
 const kcal=Math.round(nutrition.totals.kcal*servings);return validCalorie(kcal)?kcal:null;
}
