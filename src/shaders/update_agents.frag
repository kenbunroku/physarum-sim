#version 300 es
precision highp float;

uniform sampler2D srcTex;
uniform sampler2D data;

uniform vec2 resolution;
uniform float time;
uniform float sa;
uniform float ra;
uniform float so;
uniform float ss;

in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265358979323846264f;// PI
const float PI2 = PI * 2.f;
const float RAD = 1.f / PI;
const float PHI = 1.61803398874989484820459f * .1f;// Golden Ratio
const float SQ2 = 1.41421356237309504880169f * 1000.f;// Square Root of Two
float rand(in vec2 coordinate) {
  return fract(tan(distance(coordinate * (time + PHI), vec2(PHI, PI * .1f))) * SQ2);
}

float getDataValue(vec2 uv) {
  return texture(data, fract(uv)).r;
}

float getTrailValue(vec2 uv) {
  return texture(data, fract(uv)).g;
}

void main() {

  //converts degree to radians (should be done on the CPU)
  float SA = sa * RAD;
  float RA = ra * RAD;

  //downscales the parameters (should be done on the CPU)
  vec2 res = 1.f / resolution;//data trail scale
  vec2 SO = so * res;
  vec2 SS = ss * res;

  //uv = srcTex.xy
  //where to sample in the data trail texture to get the agent's world position
  vec4 src = texture(srcTex, vUv);
  vec4 val = src;

  //agent's heading
  float angle = val.z * PI2;

  // compute the sensors positions
  vec2 uvFL = val.xy + vec2(cos(angle - SA), sin(angle - SA)) * SO;
  vec2 uvF = val.xy + vec2(cos(angle), sin(angle)) * SO;
  vec2 uvFR = val.xy + vec2(cos(angle + SA), sin(angle + SA)) * SO;

  //get the values unders the sensors
  float FL = getTrailValue(uvFL);
  float F = getTrailValue(uvF);
  float FR = getTrailValue(uvFR);

  // Compute the weights for each direction
  float total = FL + F + FR;
  float weightFL = FL / total;
  float weightF = F / total;
  float weightFR = FR / total;

  // Adjust the angle based on the weights
  angle += (weightFR - weightFL) * RA;

  // Add some randomness to the angle adjustment
  angle += (rand(val.xy) - 0.5f) * RA;

  vec2 offset = vec2(cos(angle), sin(angle)) * SS;
  val.xy += offset;

  //warps the coordinates so they remains in the [0-1] interval
  val.xy = fract(val.xy);

  //converts the angle back to [0-1]
  val.z = (angle / PI2);

  fragColor = val;
}
