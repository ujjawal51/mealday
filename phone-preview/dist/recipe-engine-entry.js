import {personalizedApi} from './recommendations.js';
import {installLiveCatalogue} from './api.js';
import {createLiveCatalogue} from './live-recipes.js';
const catalogue=createLiveCatalogue({install:installLiveCatalogue});
window.MealdayRecipeEngine=async(request,url)=>{
 await catalogue.refresh();
 const response=await personalizedApi(request,url);
 response.headers.set('X-Mealday-Catalogue',catalogue.mode());
 return response;
};
