const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);

export function careerStageLayout(viewportHeight, contentHeight, mobile) {
  const overflow = Math.max(0, contentHeight - viewportHeight);
  return {
    overflow,
    inset: Math.max(0, (viewportHeight - contentHeight) / 2),
    distance: Math.max(viewportHeight * (mobile ? 1.1 : 1.6), overflow * 1.85 + viewportHeight * .55),
  };
}

// Desktop rows continue off the right edge and resume at the left of the next row.
// On narrow screens, the same records share a single downward path.
export function mountCareerTimeline(root, textReveals) {
  const stage = root.querySelector('.professional-stage');
  const content = root.querySelector('.professional-content');
  const flow = root.querySelector('.professional-flow');
  const svg = root.querySelector('.career-lines');
  const records = [...root.querySelectorAll('[data-career-record]')];
  const markers = records.map(record => record.querySelector('.career-marker'));
  let geometryKey = '', paths = [], segments = [], points = [];
  let lastDistance = -1;

  function measure() {
    const frame = flow.getBoundingClientRect();
    points = markers.map(marker => {
      const rect = marker.getBoundingClientRect();
      return {x: rect.left + rect.width / 2 - frame.left, y: rect.top + rect.height / 2 - frame.top};
    });
    const mobile = innerWidth <= 760;
    const key = [mobile, frame.width, frame.height, ...points.flatMap(p => [p.x, p.y])].join('|');
    if (key === geometryKey) return {frame, mobile};
    geometryKey = key;
    svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
    svg.replaceChildren();
    segments = [];
    if (mobile) {
      segments.push({start: points[0].y, end: points.at(-1).y, indices: records.map((_, i) => i), vertical: true});
    } else {
      points.forEach((point, index) => {
        let row = segments.find(segment => Math.abs(segment.y - point.y) < 2);
        if (!row) {row = {y: point.y, indices: []}; segments.push(row);}
        row.indices.push(index);
      });
      segments.forEach((segment, index) => {
        segment.start = index === 0 ? points[segment.indices[0]].x : -2;
        segment.end = index === segments.length - 1 ? points[segment.indices.at(-1)].x : frame.width + 2;
      });
    }
    paths = segments.map(segment => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = segment.vertical
        ? `M ${points[0].x} ${segment.start} V ${segment.end}`
        : `M ${segment.start} ${segment.y} H ${segment.end}`;
      path.setAttribute('d', d);
      path.setAttribute('pathLength', '1');
      svg.append(path);
      return path;
    });
    return {frame, mobile};
  }

  return {update(motion) {
    root.classList.toggle('timeline-enhanced', motion);
    if (!records.length) return;
    const mobileLayout = innerWidth <= 760;
    let heldProgress = 1;
    if (motion) {
      const layout = careerStageLayout(stage.clientHeight, content.offsetHeight, mobileLayout);
      if (Math.abs(layout.distance - lastDistance) > .5) {
        root.style.setProperty('--career-distance', `${layout.distance}px`);
        lastDistance = layout.distance;
      }
      heldProgress = clamp(-root.getBoundingClientRect().top / layout.distance);
      // Translate only the content that exceeds the viewport. Extra document
      // travel gives the grid and each mobile entry time to be read.
      const travel = smooth(clamp((heldProgress - .06) / .84));
      content.style.transform = `translate3d(0,${layout.inset - layout.overflow * travel}px,0)`;
    } else {
      content.style.removeProperty('transform');
      root.style.removeProperty('--career-distance');
      lastDistance = -1;
    }
    const {frame, mobile} = measure();
    const progress = motion ? Math.max(0, (heldProgress - .06) / .78) : 1;
    segments.forEach((segment, row) => {
      const length = Math.max(1, segment.end - segment.start);
      const drawn = !motion || heldProgress >= .94 ? 1 : mobile
        ? clamp((innerHeight * .72 - frame.top - segment.start) / length)
        : clamp(progress * segments.length - row);
      paths[row].style.strokeDashoffset = String(1 - drawn);
      segment.indices.forEach(index => {
        const position = ((mobile ? points[index].y : points[index].x) - segment.start) / length;
        const reveal = !motion ? 1 : smooth(clamp((drawn - position) / .12));
        // The last node is the end of the path; continue its reveal beyond that endpoint.
        const endReveal = !motion ? 1 : mobile
          ? smooth(clamp((innerHeight * .72 - frame.top - points[index].y) / 90))
          : smooth(clamp((progress * segments.length - row - position) / .12));
        const shown=Math.max(reveal, endReveal);
        records[index].style.setProperty('--record-progress', String(shown));
        records[index].querySelectorAll('[data-text-reveal]').forEach(element=>{
          if(element.getBoundingClientRect().top<innerHeight)textReveals.show(element);
        });
        records[index].classList.toggle('is-reached', !motion || drawn > position || drawn === 1);
      });
    });
  }};
}
