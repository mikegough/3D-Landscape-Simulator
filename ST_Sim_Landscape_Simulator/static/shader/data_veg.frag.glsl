// data_veg.frag

precision highp float;

uniform sampler2D tex;
uniform sampler2D sc_tex;

varying vec2 vUV;
varying vec2 scUV;

void main() {

    vec4 tex_color = texture2D(tex, vUV);
    vec4 sc_color = texture2D(sc_tex, scUV);

    if (tex_color.a <= 0.3 || sc_color.rgb == vec3(0.)) {
        discard;
    } else {
        gl_FragColor = vec4(sc_color.rgb * normalize((tex_color.rgb * .2)), 1.0);
    }
}