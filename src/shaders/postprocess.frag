#version 300 es
precision highp float;

uniform sampler2D data;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 src = texture(data, vUv);
  fragColor = vec4(src.ggg, 1.0f);
}
