<?php
/**
 * My Favourites Block - Server-side render
 * 
 * @package TVS_Virtual_Sports
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$user_id = get_current_user_id();

// If not logged in, show login prompt
if ( ! $user_id ) {
    $login_url = wp_login_url( get_permalink() );
    printf(
        '<div class="tvs-favourites-block tvs-auth-required" style="padding: var(--tvs-space-8); text-align: center; background: var(--tvs-glass-bg); backdrop-filter: blur(var(--tvs-glass-blur)); border: 1px solid var(--tvs-glass-border); border-radius: var(--tvs-radius-lg);">
            <p style="margin-bottom: var(--tvs-space-4); font-size: var(--tvs-text-lg); color: var(--tvs-color-text-primary);">Please log in to view your favourites.</p>
            <a href="%s" style="display: inline-block; padding: var(--tvs-button-padding-y) var(--tvs-button-padding-x); background: var(--tvs-color-primary); color: var(--tvs-color-text-on-primary); border-radius: var(--tvs-button-radius); text-decoration: none; font-weight: var(--tvs-button-font-weight);">Log In</a>
        </div>',
        esc_url( $login_url )
    );
    return;
}

// Get user's favourite route IDs
$fav_ids = get_user_meta( $user_id, 'tvs_favorites_routes', true );
if ( is_string( $fav_ids ) ) {
    $maybe = json_decode( $fav_ids, true );
    if ( is_array( $maybe ) ) $fav_ids = $maybe;
}
if ( ! is_array( $fav_ids ) ) $fav_ids = array();
$fav_ids = array_values( array_unique( array_map( 'intval', $fav_ids ) ) );

// If no favourites, show empty state
if ( empty( $fav_ids ) ) {
    $empty_text = isset( $attributes['emptyStateText'] ) ? $attributes['emptyStateText'] : 'No favourites yet. Start exploring routes to add some!';
    printf(
        '<div class="tvs-favourites-block tvs-empty-state" style="padding: var(--tvs-space-8); text-align: center; background: var(--tvs-glass-bg); backdrop-filter: blur(var(--tvs-glass-blur)); border: 1px solid var(--tvs-glass-border); border-radius: var(--tvs-radius-lg);">
            <p style="font-size: var(--tvs-text-lg); color: var(--tvs-color-text-secondary);">%s</p>
        </div>',
        esc_html( $empty_text )
    );
    return;
}

// Query favourite routes
$per_page = isset( $attributes['perPage'] ) ? max( 1, min( 100, intval( $attributes['perPage'] ) ) ) : 12;
$layout = isset( $attributes['layout'] ) ? sanitize_text_field( $attributes['layout'] ) : 'grid';
$columns = isset( $attributes['columns'] ) ? max( 1, min( 4, intval( $attributes['columns'] ) ) ) : 3;
$show_meta = isset( $attributes['showMeta'] ) ? (bool) $attributes['showMeta'] : true;
$show_badges = isset( $attributes['showBadges'] ) ? (bool) $attributes['showBadges'] : true;
$show_difficulty = isset( $attributes['showDifficulty'] ) ? (bool) $attributes['showDifficulty'] : true;

$args = array(
    'post_type'      => 'tvs_route',
    'post_status'    => 'publish',
    'post__in'       => $fav_ids,
    'orderby'        => 'post__in',
    'posts_per_page' => $per_page,
);

$query = new WP_Query( $args );

if ( ! $query->have_posts() ) {
    wp_reset_postdata();
    echo '<div class="tvs-favourites-block tvs-no-results" style="padding: var(--tvs-space-4); text-align: center;">No routes found.</div>';
    return;
}

// Layout-specific styles
$container_style = $layout === 'list' 
    ? 'display: flex; flex-direction: column; gap: var(--tvs-space-4);'
    : 'display: grid; grid-template-columns: repeat(' . esc_attr( $columns ) . ', 1fr); gap: var(--tvs-space-6);';

$card_style_base = 'background: var(--tvs-glass-bg); backdrop-filter: blur(var(--tvs-glass-blur)); border: 1px solid var(--tvs-glass-border); border-radius: var(--tvs-radius-lg); overflow: hidden;';
$card_style = $layout === 'list' 
    ? $card_style_base . ' display: flex; flex-direction: row;'
    : $card_style_base;

$image_style = $layout === 'list'
    ? 'width: 200px; height: 150px; object-fit: cover; flex-shrink: 0;'
    : 'width: 100%; height: 200px; object-fit: cover;';
?>
<div class="tvs-favourites-block tvs-my-favourites" data-layout="<?php echo esc_attr( $layout ); ?>">
    <div class="tvs-routes-<?php echo esc_attr( $layout ); ?> <?php echo $layout === 'grid' ? 'tvs-favourites-grid' : ''; ?>" style="<?php echo esc_attr( $container_style ); ?>">
        <?php while ( $query->have_posts() ) : $query->the_post(); 
            $id = get_the_ID();
            $permalink = get_permalink();
            $image_url = get_the_post_thumbnail_url( $id, 'medium' );
            if ( ! $image_url ) {
                $image_url = home_url( '/wp-content/uploads/2025/10/ActivityDymmy2-300x200.jpg' );
            }
            
            // Meta with fallbacks to both legacy _tvs_* and new names
            $dist_m = get_post_meta( $id, 'distance_m', true );
            if ( '' === $dist_m ) $dist_m = get_post_meta( $id, '_tvs_distance_m', true );
            if ( '' === $dist_m ) $dist_m = get_post_meta( $id, 'distance', true ); // old old fallback
            
            $elev_m = get_post_meta( $id, 'elevation_m', true );
            if ( '' === $elev_m ) $elev_m = get_post_meta( $id, '_tvs_elevation_m', true );
            if ( '' === $elev_m ) $elev_m = get_post_meta( $id, 'elevation', true ); // old old fallback
            
            $distance = tvs_human_km( $dist_m );
            $elevation = tvs_human_elevation( $elev_m );
            $difficulty = get_post_meta( $id, 'difficulty', true );
            $surface = get_post_meta( $id, 'surface', true );
        ?>
            <a href="<?php echo esc_url( $permalink ); ?>" class="tvs-route-card" style="<?php echo esc_attr( $card_style ); ?> text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                <?php if ( $image_url ) : ?>
                    <div style="position: relative; <?php echo $layout === 'list' ? 'flex-shrink: 0;' : ''; ?>">
                        <img src="<?php echo esc_url( $image_url ); ?>" alt="<?php echo esc_attr( get_the_title() ); ?>" style="<?php echo esc_attr( $image_style ); ?>">
                        
                        <?php if ( $layout === 'grid' ) : ?>
                            <?php if ( $show_badges && ( ( $show_difficulty && $difficulty ) || $surface ) ) : ?>
                                <div style="position: absolute; top: var(--tvs-space-2); left: var(--tvs-space-2); display: flex; gap: var(--tvs-space-2); z-index: 10;">
                                    <?php if ( $show_difficulty && $difficulty ) : ?>
                                        <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                            <?php echo esc_html( ucfirst( $difficulty ) ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $surface ) : ?>
                                        <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                            <?php echo esc_html( ucfirst( $surface ) ); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                            
                            <?php if ( $show_meta && ( $distance || $elevation ) ) : ?>
                                <div style="position: absolute; bottom: var(--tvs-space-2); right: var(--tvs-space-2); display: flex; gap: var(--tvs-space-2); z-index: 10;">
                                    <?php if ( $distance ) : ?>
                                        <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                            📏 <?php echo esc_html( $distance ); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if ( $elevation ) : ?>
                                        <span style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: white;">
                                            ⛰️ <?php echo esc_html( $elevation ); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>
                
                <div style="padding: var(--tvs-space-4); <?php echo $layout === 'list' ? 'flex: 1; display: flex; flex-direction: column; gap: var(--tvs-space-3);' : ''; ?>">
                    <h3 style="margin: 0 <?php echo $layout === 'list' ? '0 var(--tvs-space-2)' : '0 var(--tvs-space-2)'; ?>; font-size: var(--tvs-text-lg); font-weight: var(--tvs-font-semibold); color: var(--tvs-color-text-primary);">
                        <?php echo esc_html( get_the_title() ); ?>
                    </h3>
                    
                    <?php if ( $layout === 'list' ) : ?>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, max-content)); gap: var(--tvs-space-2); align-items: start;">
                            <?php if ( $show_badges && $show_difficulty && $difficulty ) : ?>
                                <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: var(--tvs-color-text-primary); white-space: nowrap;">
                                    <?php echo esc_html( ucfirst( $difficulty ) ); ?>
                                </span>
                            <?php endif; ?>
                            <?php if ( $show_badges && $surface ) : ?>
                                <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); font-weight: var(--tvs-badge-font-weight); color: var(--tvs-color-text-primary); white-space: nowrap;">
                                    <?php echo esc_html( ucfirst( $surface ) ); ?>
                                </span>
                            <?php endif; ?>
                            <?php if ( $show_meta && $distance ) : ?>
                                <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); color: var(--tvs-color-text-secondary); white-space: nowrap;">
                                    📏 <?php echo esc_html( $distance ); ?>
                                </span>
                            <?php endif; ?>
                            <?php if ( $show_meta && $elevation ) : ?>
                                <span style="background: var(--tvs-color-surface-raised); padding: var(--tvs-badge-padding-y) var(--tvs-badge-padding-x); border-radius: var(--tvs-badge-radius); font-size: var(--tvs-badge-font-size); color: var(--tvs-color-text-secondary); white-space: nowrap;">
                                    ⛰️ <?php echo esc_html( $elevation ); ?>
                                </span>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </a>
        <?php endwhile; ?>
    </div>
</div>
<?php
wp_reset_postdata();
