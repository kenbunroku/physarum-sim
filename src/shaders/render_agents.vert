#version 300 es

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 uv;

uniform sampler2D srcTex;

out vec3 vPosition;

void main() {
  vPosition = position;
  vec2 tex = texture(srcTex, uv).rg;
  gl_Position = vec4(tex * 2.0f - 1.0f, 0.0f, 1.0f);
  gl_PointSize = 2.0f;
}
