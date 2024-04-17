/**
 * SimpleImage Tool for the Editor.js
 * Works only with pasted image URLs and requires no server-side uploader.
 *
 * @typedef {object} SimpleImageData
 * @description Tool's input and output data format
 * @property {string} url   image URL
 * @property {string} caption   image caption
 * @property {boolean} withBorder - should image be rendered with border
 * @property {boolean} withBackground - should image be rendered with background
 * @property {boolean} stretched - should image be stretched to full width of container
 */

class SimpleImage {
    /**
     * Render plugin`s main Element and fill it with saved data
     *
     * @param {{data: SimpleImageData, config: object, api: object}}
     *   data previously saved data
     *   config - user config for Tool
     *   api - Editor.js API
     *   readOnly - read-only mode flag
     */
    
    static get toolbox() {
        return {
            title: "Image",
            icon: '<i class="fa-regular fa-image"></i>',
        };
    }

    /**
     * Sanitizer rules
     */
    static get sanitize() {
        return {
            url: {},
            withBorder: {},
            withBackground: {},
            stretched: {},
            caption: {
            	b: true, 
		     	a: {
		       		href: true
		     	},
		     	i: true
		    },
        };
    }

    /**
     * Specify paste substitutes
     *
     * @see {@link ../../../docs/tools.md#paste-handling}
     * @public
     */
    static get pasteConfig() {
        return {
            patterns: {
                image: /https?:\/\/\S+\.(gif|jpe?g|tiff|png|webp)$/i,
            },
            tags: [
                {
                    img: { src: true },
                },
            ],
            files: {
                mimeTypes: ["image/*"],
            },
        };
    }

    /**
     * Notify core that read-only mode is supported
     *
     * @returns {boolean}
     */
    static get isReadOnlySupported() {
        return true;
    }
    
    constructor({ data, config, api, readOnly }) {
        /**
         * Editor.js API
         */
        this.api = api;
        this.readOnly = readOnly;

        /**
         * When block is only constructing,
         * current block points to previous block.
         * So real block index will be +1 after rendering
         *
         * @todo place it at the `rendered` event hook to get real block index without +1;
         * @type {number}
         */
        this.blockIndex = this.api.blocks.getCurrentBlockIndex() + 1;

        /**
         * Styles
         */
        this.CSS = {
            baseClass: this.api.styles.block,
            loading: this.api.styles.loader,
            input: this.api.styles.input,

            /**
             * Tool's classes
             */
            wrapper: "cdx-simple-image",
            imageHolder: "cdx-simple-image__picture",
            caption: "cdx-simple-image__caption",
            inputURL: "cdx-simple-image__caption"
        };

        /**
         * Nodes cache
         */
        this.nodes = {
            wrapper: null,
            imageHolder: null,
            image: null,
            caption: null,
            inputURL: null
        };

        /**
         * Tool's initial data
         */
        this.data = {
            url: data.url || "",
            caption: data.caption || "",
            withBorder: data.withBorder !== undefined ? data.withBorder : false,
            withBackground: data.withBackground !== undefined ? data.withBackground : false,
            stretched: data.stretched !== undefined ? data.stretched : false,
        };

        /**
         * Available Image tunes
         */
        this.tunes = [
            {
                name: "withBorder",
                label: "Adicionar Borda",
                icon: `<img width="30" height="30" src="https://img.icons8.com/ios-glyphs/30/square-border.png" alt="square-border"/>`,
            },
            {
                name: "stretched",
                label: "Esticar Imagem",
                icon: `<img width="30" height="30" src="https://img.icons8.com/windows/32/width.png" alt="width"/>`,
            },
            {
                name: "withBackground",
                label: "Adicionar Fundo",
                icon: `<img width="30" height="30" src="https://img.icons8.com/ios-glyphs/30/wallpaper.png" alt="wallpaper"/>`,
            },
        ];
    }

    /**
     * Creates a Block:
     *  1) Show preloader
     *  2) Start to load an image
     *  3) After loading, append image and caption input
     *
     * @public
     */
    render() {
        const wrapper = this._make("div", [
            this.CSS.baseClass,
            this.CSS.wrapper,
        ]);
		const loader = this._make("div", this.CSS.loading);
		const imageHolder = this._make("div", this.CSS.imageHolder);
		const image = this._make("img");
		const inputURL = this._make("input", [this.CSS.input, this.CSS.caption]);
		const caption = this._make("div", [this.CSS.input, this.CSS.caption], {
            contentEditable: !this.readOnly,
            innerHTML: this.data.caption || "",
        });

		inputURL.placeholder = "Cole a URL da imagem...";
        caption.dataset.placeholder = "Descrição da imagem...";

        wrapper.appendChild(loader);
        wrapper.appendChild(inputURL);

        if (this.data.url) {
            image.src = this.data.url;
        }

        inputURL.addEventListener("paste", (event) => {
        	const url = event.clipboardData.getData("text");
	        image.src = url;
        });

        image.onload = (e) => {
            wrapper.classList.remove(this.CSS.loading);
            imageHolder.appendChild(image);
            wrapper.appendChild(imageHolder);
            wrapper.appendChild(caption);
            loader.remove();
            inputURL.remove();
            this._acceptTuneView();
        };

        image.onerror = (e) => {
            // @todo use api.Notifies.show() to show error notification
            console.log("Falha ao carregar a imagem", e);
        };

        this.nodes.inputURL = inputURL;
        this.nodes.imageHolder = imageHolder;
        this.nodes.wrapper = wrapper;
        this.nodes.image = image;
        this.nodes.caption = caption;
        
        return wrapper;
    }

    /**
     * @public
     * @param {Element} blockContent - Tool's wrapper
     * @returns {SimpleImageData}
     */
    save(blockContent) {
        const image = blockContent.querySelector("img");
        const caption = blockContent.querySelector("." + this.CSS.caption);

        if (!image) {
            return this.data;
        }

        return Object.assign(this.data, {
            url: image.src,
            caption: caption.innerHTML,
        });
    }

    /**
     * Read pasted image and convert it to base64
     *
     * @static
     * @param {File} file
     * @returns {Promise<SimpleImageData>}
     */
    onDropHandler(file) {
        const reader = new FileReader();

        reader.readAsDataURL(file);

        return new Promise((resolve) => {
            reader.onload = (event) => {
                resolve({
                    url: event.target.result,
                    caption: null,
                });
            };
        });
    }

    /**
     * On paste callback that is fired from Editor.
     *
     * @param {PasteEvent} event - event with pasted config
     */
    onPaste(event) {
        switch (event.type) {
            case "tag": {
                const img = event.detail.data;

                this.data = {
                    url: img.src,
                };
                break;
            }

            case "pattern": {
                const { data: text } = event.detail;

                this.data = {
                    url: text,
                };
                break;
            }

            case "file": {
                const { file } = event.detail;

                this.onDropHandler(file).then((data) => {
                    this.data = data;
                });

                break;
            }
        }
    }

    /**
     * Returns image data
     *
     * @returns {SimpleImageData}
     */
    get data() {
        return this._data;
    }

    /**
     * Set image data and update the view
     *
     * @param {SimpleImageData} data
     */
    set data(data) {
        this._data = Object.assign({}, this.data, data);

        if (this.nodes.image) {
            this.nodes.image.src = this.data.url;
        }

        if (this.nodes.caption) {
            this.nodes.caption.innerHTML = this.data.caption;
        }
    }

    /**
     * Returns image tunes config
     *
     * @returns {Array}
     */
    renderSettings() {
        return this.tunes.map((tune) => ({
            ...tune,
            label: this.api.i18n.t(tune.label),
            toggle: true,
            onActivate: () => this._toggleTune(tune.name),
            isActive: !!this.data[tune.name],
        }));
    }

    /**
     * Helper for making Elements with attributes
     *
     * @param  {string} tagName           - new Element tag name
     * @param  {Array|string} classNames  - list or name of CSS classname(s)
     * @param  {object} attributes        - any attributes
     * @returns {Element}
     */
    _make(tagName, classNames = null, attributes = {}) {
        const el = document.createElement(tagName);

        if (Array.isArray(classNames)) {
            el.classList.add(...classNames);
        } else if (classNames) {
            el.classList.add(classNames);
        }

        for (const attrName in attributes) {
            el[attrName] = attributes[attrName];
        }

        return el;
    }

    /**
     * Click on the Settings Button
     *
     * @private
     * @param tune
     */
    _toggleTune(tune) {
        this.data[tune] = !this.data[tune];
        this._acceptTuneView();
    }

    /**
     * Add specified class corresponds with activated tunes
     *
     * @private
     */
    _acceptTuneView() {
        this.tunes.forEach((tune) => {
            this.nodes.imageHolder.classList.toggle(
                this.CSS.imageHolder +
                    "--" +
                    tune.name.replace(
                        /([A-Z])/g,
                        (g) => `-${g[0].toLowerCase()}`
                    ),
                !!this.data[tune.name]
            );

            if (tune.name === "stretched") {
                this.api.blocks.stretchBlock(
                    this.blockIndex,
                    !!this.data.stretched
                );
            }
        });
    }
}
