#version 300 es
precision highp float;

uniform sampler2D points;
uniform sampler2D srcTex;
uniform vec2 resolution;
uniform float time;
uniform float decay;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 res = 1.f / resolution;
  float pos = texture(points, vUv).r;

  //accumulator
  float col = 0.f;

  //blur box size
  const float dim = 1.f;

  //weight
  float weight = 1.f / pow(2.f * dim + 1.f, 2.f);

  for(float i = -dim; i <= dim; i++) {
    for(float j = -dim; j <= dim; j++) {
      vec3 val = texture(srcTex, fract(vUv + res * vec2(i, j))).rgb;
      col += val.r * weight + val.g * weight * .5f;
    }
  }

  vec4 fin = vec4(pos * decay, col * decay, .5f, 1.f);
  fragColor = clamp(fin, 0.01f, 1.f);
}
