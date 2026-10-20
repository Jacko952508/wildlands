// A normal Spawn player: follows a human without teleporting or editing the world.
// All movement uses the supported @spawnco/client play API.
export default async (play) => {
  const self = await play.where();
  const peers = (await play.players()).filter(p => !p.isSelf && !p.parked && (p.position || Number.isFinite(p.x)));
  const preferred = peers.find(p => /jbowzer|jack|bowerman/i.test(p.name || ""));
  const buddy = preferred || (peers.length === 1 ? peers[0] : null);
  if (!buddy) return {action:"waiting-for-you",me:{x:self.x,z:self.z},otherPlayers:peers.map(p=>p.name)};
  const pos=buddy.position || {x:buddy.x,y:buddy.y,z:buddy.z};
  const distance=Math.hypot(pos.x-self.x,pos.z-self.z);
  if(distance>3){
    try { await play.moveTo(pos,{arriveRadius:2.7,timeoutSec:7}); }
    catch(e){ return {action:"path-blocked",friend:buddy.name,distance:Number(distance.toFixed(1)),error:String(e).slice(0,200)}; }
  }
  return {action:distance>3?"following":"beside-you",friend:buddy.name,distance:Number(distance.toFixed(1)),me:{x:self.x,z:self.z}};
};
