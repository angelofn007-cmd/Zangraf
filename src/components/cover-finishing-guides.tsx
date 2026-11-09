import type {PrintSpec} from '@/lib/layout-projects';
import {coverMarginDescription,type CoverMargins} from '@/lib/cover-production';

/** Screen-only finishing marks. Production rendering never includes this component. */
export function CoverFinishingGuides({spec,margins}:{spec:PrintSpec;margins?:CoverMargins}){
 if(!margins||!Object.values(margins).some(Boolean))return null;
 // Legacy projects display the trim area; new covers display the entire JPG (bleed = 0).
 const top=Math.max(0,margins.topMm-spec.bleedMm)/spec.heightMm*100;
 const bottom=Math.max(0,margins.bottomMm-spec.bleedMm)/spec.heightMm*100;
 const left=Math.max(0,margins.leftMm-spec.bleedMm)/spec.widthMm*100;
 const right=Math.max(0,margins.rightMm-spec.bleedMm)/spec.widthMm*100;
 return <div className="dm-finishing-guides" role="img" aria-label={coverMarginDescription(margins)}>
  {top>0&&<span className="dm-finishing-band top" style={{height:top+'%'}}/>}
  {bottom>0&&<span className="dm-finishing-band bottom" style={{height:bottom+'%'}}/>}
  {left>0&&<span className="dm-finishing-band left" style={{width:left+'%'}}/>}
  {right>0&&<span className="dm-finishing-band right" style={{width:right+'%'}}/>}
  <span className="dm-finishing-line" style={{top:top+'%',bottom:bottom+'%',left:left+'%',right:right+'%',borderTopWidth:margins.topMm?1:0,borderBottomWidth:margins.bottomMm?1:0,borderLeftWidth:margins.leftMm?1:0,borderRightWidth:margins.rightMm?1:0}}/>
 </div>;
}
