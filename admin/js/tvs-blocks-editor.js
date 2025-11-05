(function(){
  var blocks = wp.blocks;
  var el = wp.element && wp.element.createElement;
  if (!blocks || !el) return;

  function ensure(name, settings){
    if (!blocks.getBlockType(name)){
      blocks.registerBlockType(name, settings);
    }
  }

  ensure('tvs-virtual-sports/invite-friends', {
    title: 'TVS Invite Friends',
    icon: 'share',
    category: 'widgets',
    keywords: ['tvs', 'invite', 'friends', 'codes'],
    edit: function(){
      return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS Invite Friends');
    },
    save: function(){ return null; }
  });

  ensure('tvs-virtual-sports/my-activities', {
    title: 'TVS My Activities',
    icon: 'list-view',
    category: 'widgets',
    keywords: ['tvs', 'activities', 'routes'],
    edit: function(){
      return el('div', { className: 'tvs-block-edit-placeholder' }, 'TVS My Activities');
    },
    save: function(){ return null; }
  });
})();
