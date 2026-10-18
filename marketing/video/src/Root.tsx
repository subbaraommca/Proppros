import React from "react";
import { Composition } from "remotion";
import { OneCalmMonth, TOTAL_FRAMES } from "./OneCalmMonth";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="OneCalmMonth"
    component={OneCalmMonth}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
