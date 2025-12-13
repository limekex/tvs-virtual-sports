import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl, ToggleControl, TextControl } from '@wordpress/components';
import { createElement, Fragment } from '@wordpress/element';

registerBlockType( 'tvs/routes-grid', {
    title: __( 'Routes Grid', 'tvs-virtual-sports' ),
    attributes: {
        perPage: { type:'number', default:9 },
        orderBy: { type:'string', default:'date' },
        order: { type:'string', default:'DESC' },
        region: { type:'string', default:'' },
        type: { type:'string', default:'' },
        season: { type:'string', default:'' },
    columns: { type:'number', default:3 },
        layout: { type:'string', default:'grid' },
        showBadges: { type:'boolean', default:true },
        showMeta: { type:'boolean', default:true },
    showDifficulty: { type:'boolean', default:true },
    showPagination: { type:'boolean', default:true },
    showMaxResults: { type:'number', default:0 },
    showBookmarkButton: { type:'boolean', default:false },
    },
    edit( { attributes, setAttributes } ) {
        const props = useBlockProps();
        return createElement( Fragment, {},
            createElement( InspectorControls, {},
                createElement( PanelBody, { title: __('Filters', 'tvs-virtual-sports'), initialOpen: true },
                    createElement( TextControl, { label: __('Region (slug)', 'tvs-virtual-sports'), value: attributes.region || '', onChange:(v)=>setAttributes({region:v}) }),
                    createElement( TextControl, { label: __('Type (slug)', 'tvs-virtual-sports'), value: attributes.type || '', onChange:(v)=>setAttributes({type:v}) }),
                    createElement( SelectControl, { label: __('Season', 'tvs-virtual-sports'), value: attributes.season || '', onChange:(v)=>setAttributes({season:v}), options:[{label:__('Any','tvs-virtual-sports'),value:''},{label:'Spring',value:'spring'},{label:'Summer',value:'summer'},{label:'Autumn',value:'autumn'},{label:'Winter',value:'winter'}] }),
                    createElement( SelectControl, { label: __('Order By', 'tvs-virtual-sports'), value: attributes.orderBy, onChange:(v)=>setAttributes({orderBy:v}), options:[{label:'Date',value:'date'},{label:'Title',value:'title'}] }),
                    createElement( SelectControl, { label: __('Order', 'tvs-virtual-sports'), value: attributes.order, onChange:(v)=>setAttributes({order:v}), options:[{label:'DESC',value:'DESC'},{label:'ASC',value:'ASC'}] }),
                    createElement( SelectControl, { label: __('Columns', 'tvs-virtual-sports'), value: attributes.columns, onChange:(v)=>setAttributes({columns:parseInt(v,10)||3}), options:[1,2,3,4,5,6].map(n=>({label:String(n),value:n})) }),
                ),
                createElement( PanelBody, { title: __('Display', 'tvs-virtual-sports'), initialOpen: false },
                    createElement( SelectControl, { label: __('Layout', 'tvs-virtual-sports'), value: attributes.layout || 'grid', onChange:(v)=>setAttributes({layout:v}), options:[{label:'Grid',value:'grid'},{label:'List',value:'list'}] }),
                    createElement( ToggleControl, { label: __('Show badges','tvs-virtual-sports'), checked: !!attributes.showBadges, onChange:(v)=>setAttributes({showBadges:!!v}) }),
                    createElement( ToggleControl, { label: __('Show meta','tvs-virtual-sports'), checked: !!attributes.showMeta, onChange:(v)=>setAttributes({showMeta:!!v}) }),
                    createElement( ToggleControl, { label: __('Show difficulty','tvs-virtual-sports'), checked: !!attributes.showDifficulty, onChange:(v)=>setAttributes({showDifficulty:!!v}) }),
                    createElement( ToggleControl, { label: __('Show pagination','tvs-virtual-sports'), checked: !!attributes.showPagination, onChange:(v)=>setAttributes({showPagination:!!v}) }),
                    !attributes.showPagination && createElement( TextControl, { label: __('Max results (no pagination)','tvs-virtual-sports'), type:'number', value: attributes.showMaxResults || 0, onChange:(v)=>setAttributes({showMaxResults: parseInt(v,10) || 0}) }),
                    createElement( ToggleControl, { label: __('Show bookmark button','tvs-virtual-sports'), checked: !!attributes.showBookmarkButton, onChange:(v)=>setAttributes({showBookmarkButton:!!v}) }),
                )
            ),
            createElement('div', props, __('Routes Grid (server-rendered on frontend)', 'tvs-virtual-sports'))
        );
    },
    save() { return null; }
} );
