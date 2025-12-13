<?php
/**
 * Server-side render for Routes Grid block
 * Layout: image background with overlay
 * - Title: top center
 * - Badges: season, region (top area)
 * - Meta (distance, elevation, duration): bottom center, evenly spaced
 * - Difficulty: icon indicator (1 easy, 2 moderate, 3 hard)
 */

// Attributes with sane defaults
$per_page       = isset( $attributes['perPage'] ) ? max( 1, intval( $attributes['perPage'] ) ) : 6;
$layout         = ( isset($attributes['layout']) && in_array($attributes['layout'], ['grid','list'], true) ) ? $attributes['layout'] : 'grid';
$columns        = isset( $attributes['columns'] ) ? max( 1, min( 6, intval( $attributes['columns'] ) ) ) : 3;
$order_by       = isset( $attributes['orderBy'] ) && preg_match( '/^[a-z_]+$/', (string) $attributes['orderBy'] ) ? (string) $attributes['orderBy'] : 'date';
$order          = isset( $attributes['order'] ) && strtoupper( (string) $attributes['order'] ) === 'ASC' ? 'ASC' : 'DESC';
$filter_region  = isset( $attributes['region'] ) ? trim( (string) $attributes['region'] ) : '';
$filter_type    = isset( $attributes['type'] ) ? trim( (string) $attributes['type'] ) : '';
$filter_season  = isset( $attributes['season'] ) ? trim( strip_tags( (string) $attributes['season'] ) ) : '';
$show_badges    = array_key_exists( 'showBadges', $attributes ) ? (bool) $attributes['showBadges'] : true;
$show_meta      = array_key_exists( 'showMeta', $attributes ) ? (bool) $attributes['showMeta'] : true;
$show_difficulty= array_key_exists( 'showDifficulty', $attributes ) ? (bool) $attributes['showDifficulty'] : true;
$show_pagination= array_key_exists( 'showPagination', $attributes ) ? (bool) $attributes['showPagination'] : true;
$max_results    = isset( $attributes['showMaxResults'] ) ? max( 0, intval( $attributes['showMaxResults'] ) ) : 0;
$show_bookmark  = array_key_exists( 'showBookmarkButton', $attributes ) ? (bool) $attributes['showBookmarkButton'] : false;

$page_param = isset($_GET['tvs_page']) ? intval($_GET['tvs_page']) : 1;
$page_param = max(1, $page_param);

// Favorites lookup for current user
$current_user_id = function_exists('get_current_user_id') ? get_current_user_id() : 0;
$favorites_ids = [];
if ( $current_user_id ) {
	$favorites_ids = get_user_meta( $current_user_id, 'tvs_favorites_routes', true );
	if ( is_string( $favorites_ids ) ) {
		$maybe = json_decode( $favorites_ids, true );
		if ( is_array( $maybe ) ) $favorites_ids = $maybe;
	}
	if ( ! is_array( $favorites_ids ) ) $favorites_ids = [];
	// normalize to ints
	$favorites_ids = array_map( 'intval', $favorites_ids );
}


// Determine paging behavior
if ( ! $show_pagination ) {
    // When pagination is hidden, cap results if max_results > 0
    if ( $max_results > 0 ) {
        $per_page = $max_results;
    }
}

$args = [
	'post_type'      => 'tvs_route',
	'posts_per_page' => $per_page,
	'post_status'    => 'publish',
	'orderby'        => in_array( $order_by, [ 'date', 'title', 'meta_value_num' ], true ) ? $order_by : 'date',
	'order'          => $order,
	'paged'          => $show_pagination ? $page_param : 1,
];

// Optional region filter (taxonomy)
if ( ! empty( $filter_region ) ) {
	$args['tax_query'] = [
		[
			'taxonomy' => 'tvs_region',
			'field'    => 'slug',
			'terms'    => $filter_region,
		],
	];
}

// Optional season filter (meta)
if ( ! empty( $filter_season ) ) {
	$args['meta_query'] = [
		[
			'key'   => 'season',
			'value' => $filter_season,
			'compare' => '=',
		],
	];
}

// Optional type filter - prefer taxonomy tvs_type if registered, fallback to meta 'type'
if ( ! empty( $filter_type ) ) {
	if ( function_exists('taxonomy_exists') && taxonomy_exists('tvs_type') ) {
		$args['tax_query'] = isset($args['tax_query']) && is_array($args['tax_query']) ? $args['tax_query'] : [];
		$args['tax_query'][] = [
			'taxonomy' => 'tvs_type',
			'field'    => 'slug',
			'terms'    => $filter_type,
		];
	} else {
		$args['meta_query'] = isset($args['meta_query']) && is_array($args['meta_query']) ? $args['meta_query'] : [];
		$args['meta_query'][] = [
			'key'   => 'type',
			'value' => $filter_type,
			'compare' => '=',
		];
	}
}

$q = new WP_Query( $args );

if ( ! $q->have_posts() ) {
	echo '<p>' . esc_html__( 'No routes available yet.', 'tvs-virtual-sports' ) . '</p>';
	return;
}

// Helper functions are now in plugin includes/helpers.php
// tvs_human_km(), tvs_human_elevation() are globally available

// Additional helpers specific to routes-grid
if ( ! function_exists( 'tvs_human_duration' ) ) {
	function tvs_human_duration( $seconds ) {
		$s = intval( $seconds );
		if ( $s <= 0 ) return '';
		$min = floor( $s / 60 );
		if ( $min < 60 ) return $min . ' min';
		$h = floor( $min / 60 );
		$rem = $min % 60;
		return sprintf( '%d:%02d h', $h, $rem );
	}
}
if ( ! function_exists( 'tvs_diff_count' ) ) {
	function tvs_diff_count( $val ) {
		$map = [ 'easy' => 1, 'moderate' => 2, 'medium' => 2, 'hard' => 3, 'difficult' => 3 ];
		$k = strtolower( trim( (string) $val ) );
		return $map[ $k ] ?? 0;
	}
}

if ( $layout === 'grid' ) {
	echo '<div class="tvs-routes-grid" style="--tvs-routes-cols: ' . intval( $columns ) . ';">';
} else {
	echo '<div class="tvs-routes-list">';
}
while ( $q->have_posts() ) {
	$q->the_post();
	$id    = get_the_ID();
	$title = get_the_title();
	$link  = get_permalink();
	$img   = get_the_post_thumbnail_url( $id, 'large' );
	if ( ! $img ) {
		$img = home_url( '/wp-content/uploads/2025/10/ActivityDymmy2-300x200.jpg' );
	}

	// Meta with fallbacks to both legacy _tvs_* and new names
	$dist  = get_post_meta( $id, 'distance_m', true );
	if ( '' === $dist ) $dist = get_post_meta( $id, '_tvs_distance_m', true );
	$elev  = get_post_meta( $id, 'elevation_m', true );
	if ( '' === $elev ) $elev = get_post_meta( $id, '_tvs_elevation_m', true );
	$dur   = get_post_meta( $id, 'duration_s', true );
	if ( '' === $dur ) $dur = get_post_meta( $id, '_tvs_duration_s', true );
	$difficulty = get_post_meta( $id, 'difficulty', true );
	$season     = get_post_meta( $id, 'season', true );

	// Region term name(s)
	$region_names = [];
	$terms = get_the_terms( $id, 'tvs_region' );
	if ( $terms && ! is_wp_error( $terms ) ) {
		foreach ( $terms as $t ) { $region_names[] = $t->name; }
	}

	echo '<article class="tvs-route-card">';
	// Clickable card wrapper
	if ( $layout === 'grid' ) {
		echo '<a class="tvs-route-card__link" href="' . esc_url( $link ) . '">';
		echo '<div class="tvs-route-card__bg"' . ( $img ? ' style="background-image:url(' . esc_url( $img ) . ');"' : '' ) . '></div>';
		echo '<div class="tvs-route-card__overlay">';
	} else {
		// list layout: thumbnail left, content right
		echo '<div class="tvs-route-row">';
		echo $img ? '<a class="tvs-route-row__thumb" href="' . esc_url($link) . '"><img src="' . esc_url($img) . '" alt="" loading="lazy" /></a>' : '';
			echo '<div class="tvs-route-row__body">';
				if ( $show_bookmark ) {
					$is_fav = $current_user_id && in_array( (int)$id, $favorites_ids, true );
					echo '<button class="tvs-bookmark-btn tvs-bookmark-btn--row' . ( $is_fav ? ' is-active' : '' ) . '" type="button" aria-pressed="' . ( $is_fav ? 'true' : 'false' ) . '" aria-label="' . esc_attr__( 'Bookmark route', 'tvs-virtual-sports' ) . '" data-route="' . esc_attr( (string)$id ) . '">' . ( $is_fav ? '★' : '☆' ) . '</button>';
				}
		echo '<h3 class="tvs-route-row__title"><a href="' . esc_url($link) . '">' . esc_html($title) . '</a></h3>';
	}

	// Top cluster (grid only): centered title, badges and difficulty indicator
	if ( $layout === 'grid' ) {
		echo '<div class="tvs-route-card__top">';
			echo '<h3 class="tvs-route-card__title">' . esc_html( $title ) . '</h3>';
			if ( $show_badges ) {
				$badges = [];
				if ( ! empty( $season ) ) {
					$badges[] = '<span class="tvs-badge tvs-badge--season">' . esc_html( ucfirst( $season ) ) . '</span>';
				}
				if ( ! empty( $region_names ) ) {
					$badges[] = '<span class="tvs-badge tvs-badge--region">' . esc_html( implode( ', ', $region_names ) ) . '</span>';
				}
				if ( ! empty( $badges ) ) {
					echo '<div class="tvs-route-card__badges">' . implode( '', $badges ) . '</div>';
				}
			}
			if ( $show_difficulty ) {
				$count = tvs_diff_count( $difficulty );
				if ( $count > 0 ) {
					echo '<div class="tvs-route-card__difficulty" aria-label="Difficulty: ' . esc_attr( $difficulty ) . '">';
					for ( $i = 0; $i < $count; $i++ ) {
						echo '<span class="tvs-diff-dot" aria-hidden="true"></span>';
					}
					echo '</div>';
				}
			}
		echo '</div>'; // top
	}

	// Bottom meta row (grid only)
	if ( $layout === 'grid' && $show_meta ) {
		$meta_items = [];
		if ( $dist ) { $meta_items[] = '<span class="meta-item meta-item--distance"><span class="meta-icon" aria-hidden="true">⟷</span>' . esc_html( tvs_human_km( $dist ) ) . '</span>'; }
		if ( $elev ) { $meta_items[] = '<span class="meta-item meta-item--elevation"><span class="meta-icon" aria-hidden="true">⛰</span>' . esc_html( intval( $elev ) ) . ' m</span>'; }
		if ( $dur )  { $meta_items[] = '<span class="meta-item meta-item--duration"><span class="meta-icon" aria-hidden="true">⏱</span>' . esc_html( tvs_human_duration( $dur ) ) . '</span>'; }
		if ( ! empty( $meta_items ) ) {
			echo '<div class="tvs-route-card__meta">' . implode( '', $meta_items ) . '</div>';
		}
	}

	if ( $layout === 'grid' ) {
		echo '</div>'; // overlay
		echo '</a>';
		if ( $show_bookmark ) {
			// Place the button outside the anchor to avoid navigating when clicking the bookmark
			$is_fav = $current_user_id && in_array( (int)$id, $favorites_ids, true );
			echo '<button class="tvs-bookmark-btn' . ( $is_fav ? ' is-active' : '' ) . '" type="button" aria-pressed="' . ( $is_fav ? 'true' : 'false' ) . '" aria-label="' . esc_attr__( 'Bookmark route', 'tvs-virtual-sports' ) . '" data-route="' . esc_attr( (string)$id ) . '">' . ( $is_fav ? '★' : '☆' ) . '</button>';
		}
	} else {
		// meta row for list
		if ( $show_meta ) {
			$meta_items = [];
			if ( $dist ) { $meta_items[] = '<span class="meta-item meta-item--distance"><span class="meta-icon" aria-hidden="true">⟷</span>' . esc_html( tvs_human_km( $dist ) ) . '</span>'; }
			if ( $elev ) { $meta_items[] = '<span class="meta-item meta-item--elevation"><span class="meta-icon" aria-hidden="true">⛰</span>' . esc_html( intval( $elev ) ) . ' m</span>'; }
			if ( $dur )  { $meta_items[] = '<span class="meta-item meta-item--duration"><span class="meta-icon" aria-hidden="true">⏱</span>' . esc_html( tvs_human_duration( $dur ) ) . '</span>'; }
			if ( ! empty( $meta_items ) ) {
				echo '<div class="tvs-route-row__meta">' . implode( '', $meta_items ) . '</div>';
			}
		}
		echo '</div>'; // body
		echo '</div>'; // row
	}
	echo '</article>';
}
echo '</div>';
wp_reset_postdata();

// Pagination (SSR): use tvs_page query var
$max_pages = intval( $q->max_num_pages );
if ( $show_pagination && $max_pages > 1 ) {
	$curr = $page_param;
	$base_url = remove_query_arg( 'tvs_page' );
	$prev_url = $curr > 1 ? add_query_arg( 'tvs_page', $curr - 1, $base_url ) : '';
	$next_url = $curr < $max_pages ? add_query_arg( 'tvs_page', $curr + 1, $base_url ) : '';
	echo '<nav class="tvs-pagination" aria-label="' . esc_attr__( 'Routes pagination', 'tvs-virtual-sports' ) . '">';
	if ( $prev_url ) echo '<a class="tvs-page-prev" href="' . esc_url( $prev_url ) . '">&laquo; ' . esc_html__( 'Previous', 'tvs-virtual-sports' ) . '</a>';
	echo '<span class="tvs-page-status">' . sprintf( esc_html__( 'Page %1$s of %2$s', 'tvs-virtual-sports' ), intval($curr), intval($max_pages) ) . '</span>';
	if ( $next_url ) echo '<a class="tvs-page-next" href="' . esc_url( $next_url ) . '">' . esc_html__( 'Next', 'tvs-virtual-sports' ) . ' &raquo;</a>';
	echo '</nav>';
}
