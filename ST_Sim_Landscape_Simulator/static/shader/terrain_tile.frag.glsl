// terrain.frag

uniform sampler2D active_texture;

varying vec2 vUV;

// light uniforms
uniform vec3 ambientProduct;
uniform vec3 diffuseProduct;
uniform vec3 specularProduct;
uniform float shininess;
uniform int useElevation;

// light varyings
varying vec3 fN;
varying vec3 fE;
varying vec3 fL;

// elevation varying
varying float vAmount;

void main() {

    vec4 myColor = texture2D(active_texture, vUV);
    if (useElevation == 1) {
        myColor = vec4(vec3(vAmount), 1.0);
    }

	// compute lighting
	vec3 N = normalize(fN);
    vec3 E = normalize(fE);
    vec3 L = normalize(fL);

    vec3 H = normalize( L + E );

    vec4 ambient = vec4(ambientProduct,1.0)*myColor;

    float diffDot = max(dot(L, N), 0.0);
    vec4 diffuse = diffDot*vec4(diffuseProduct,1.0)*myColor;

    float specDot = pow(max(dot(N, H), 0.0), shininess);
    vec4 specular = specDot*vec4(specularProduct,1.0)*myColor;

    // discard the specular highlight if the light's behind the vertex
    if( dot(L, N) < 0.0 ) {
	   specular = vec4(0.0, 0.0, 0.0, 1.0);
    }

    vec4 finalColor = ambient + diffuse + specular;
    finalColor.a = 1.0;
	gl_FragColor = finalColor;
}