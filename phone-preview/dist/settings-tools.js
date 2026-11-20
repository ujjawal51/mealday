export function weeklyCalendar(day=0,time='10:00',now=new Date()){
  if(!Number.isInteger(day)||day<0||day>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Choose a valid day and time.');
  const [hour,minute]=time.split(':').map(Number),start=new Date(now);
  start.setDate(start.getDate()+(day-start.getDay()+7)%7);start.setHours(hour,minute,0,0);
  if(start<=now)start.setDate(start.getDate()+7);
  const pad=n=>String(n).padStart(2,'0');
  const date=start.getFullYear()+pad(start.getMonth()+1)+pad(start.getDate())+'T'+pad(hour)+pad(minute)+'00';
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mealday//Weekly Planner//EN','BEGIN:VEVENT','UID:mealday-weekly-plan-'+day+'-'+time.replace(':','')+'@mealday','DTSTAMP:'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),'DTSTART:'+date,'DURATION:PT15M','RRULE:FREQ=WEEKLY;BYDAY='+['SU','MO','TU','WE','TH','FR','SA'][day],'SUMMARY:Plan your week with Mealday','DESCRIPTION:Choose your meals and prepare your grocery list.','BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY','DESCRIPTION:Time to plan your meals','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export function kitchenBackup(state,history,now=new Date()){
  return JSON.stringify({app:'Mealday',version:1,exportedAt:now.toISOString(),state,history},null,2);
}
