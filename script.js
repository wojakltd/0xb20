document.addEventListener('DOMContentLoaded',()=>{
const boot=document.getElementById('boot-screen');
setTimeout(()=>{
 if(boot){
   boot.style.opacity='0';
   setTimeout(()=>boot.remove(),800);
 }
},2000);

const cards=document.querySelectorAll('.card,.section');
const io=new IntersectionObserver(entries=>{
 entries.forEach(e=>{
   if(e.isIntersecting){
     e.target.style.opacity='1';
     e.target.style.transform='translateY(0)';
   }
 });
});
cards.forEach(c=>{
 c.style.opacity='0';
 c.style.transform='translateY(30px)';
 c.style.transition='all .7s ease';
 io.observe(c);
});

console.log('B20 LAB ONLINE');
});
