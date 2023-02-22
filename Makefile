# Copyright 2015 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Build rules for JADE

# Closure compiler
CLOSURE_JAR := tools/closure_compiler.jar
$(CLOSURE_JAR):
	curl -o tools/compiler.zip http://dl.google.com/closure-compiler/compiler-latest.zip
	unzip -Z1 tools/compiler.zip  | grep jar | xargs -I % unzip -p tools/compiler.zip % > $@
	rm tools/compiler.zip

define COMPILE_JS
$1: $2 $(CLOSURE_JAR)
	mkdir -p $$(@D)
	cat $2 | grep -v remove-on-compile | java -jar $(CLOSURE_JAR) --compilation_level SIMPLE --language_in ES6 --language_out ES5 > $1
endef

define CONCAT_FILES
$1: $2
	mkdir -p $$(@D)
	cat $2 | grep -v remove-on-compile > $1
endef

define CONCAT_CSS
$1: $2
	mkdir -p $$(@D)
	cat $2 | cssmin > $1
endef


# PEG parse for SQLite WHERE clause
worker/where.peg.js: tools/where.peg
	mkdir -p $(@D)
	cat $< | pegjs -e 'var Parser'> $@

# Main project compiler
web_ui: third_party_deps out/worker/sql.worker.js out/deps/app.js out/index.html out/deps/app.css
	cp -r icons out/
	cp -r _locales out/
	cp -r third_party out/

$(eval $(call COMPILE_JS, out/worker/sql.worker.js, worker/where.peg.js worker/import_sql.js worker/mimetypes.js worker/sql.worker.js))
$(eval $(call COMPILE_JS, out/deps/app.js, js/*.js components/*/*.js))

$(eval $(call CONCAT_FILES, out/index.html, index.html))
$(eval $(call CONCAT_CSS, out/deps/app.css, css/*.css components/*/*.css))


# Extension compiler
extension: out/extension.zip

out/extension.zip: web_ui out/manifest.json out/background.js
	cd out && zip -r extension.zip manifest.json background.js index.html deps third_party icons worker _locales

$(eval $(call CONCAT_FILES, out/manifest.json, manifest.json))
$(eval $(call COMPILE_JS, out/background.js, background.js))

clean:
	rm -rf out

# All the third party dependencies
third_party_deps: material_icons codemirror third_party/sql/sql.js third_party/jquery/jquery.min.js materialize

# Material design icons
MATERIAL_ICON := $(addprefix third_party/icons/,MaterialIcons-Regular.ttf MaterialIcons-Regular.eot MaterialIcons-Regular.woff MaterialIcons-Regular.woff2)
material_icons: $(MATERIAL_ICON)

$(MATERIAL_ICON):
	mkdir -p $(@D)
	curl -o $@ https://raw.githubusercontent.com/google/material-design-icons/master/iconfont/$(@F)

# Codemirror
codemirror: third_party/codemirror/codemirror.css third_party/codemirror/codemirror-compressed.js third_party/codemirror/LICENSE
$(eval $(call COMPILE_JS, third_party/codemirror/codemirror-compressed.js, $(addprefix bower_components/codemirror/,lib/codemirror.js mode/sql/sql.js addon/display/placeholder.js)))
$(eval $(call CONCAT_CSS, third_party/codemirror/codemirror.css, bower_components/codemirror/lib/codemirror.css))
$(eval $(call CONCAT_FILES, third_party/codemirror/LICENSE, bower_components/codemirror/LICENSE))

# Javascript SQL library
$(eval $(call COMPILE_JS, third_party/sql/sql.js, bower_components/sql.js/js/sql.js))

# JQuery
$(eval $(call CONCAT_FILES, third_party/jquery/jquery.min.js, bower_components/jquery/dist/jquery.min.js))

# Custom build of materialize library
materialize: $(addprefix third_party/materialize/,js/materialize.min.js css/materialize.min.css fonts/roboto LICENSE)

$(eval $(call COMPILE_JS, third_party/materialize/js/materialize.min.js, $(addprefix bower_components/materialize/js/,jquery.easing.1.3.js velocity.min.js global.js tooltip.js waves.js toasts.js forms.js)))
$(eval $(call CONCAT_FILES, third_party/materialize/LICENSE, bower_components/materialize/LICENSE))

third_party/materialize/fonts/roboto: bower_components/materialize/fonts/roboto
	mkdir -p $(@D)
	cp -rf $< $@

third_party/materialize/css/materialize.min.css: tools/materialize.scss
	mkdir -p $(@D)
	sass --no-source-map --style=compressed $< > $@


